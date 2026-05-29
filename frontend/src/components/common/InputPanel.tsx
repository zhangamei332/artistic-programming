import { useState, useRef, useCallback, useEffect } from 'react';
import { Input, Button, Select, Tooltip, Modal, message, Upload } from 'antd';
import {
  ThunderboltOutlined,
  ToolOutlined,
  FolderOpenOutlined,
  SwapOutlined,
  FileImageOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import styles from './InputPanel.module.css';

const { TextArea } = Input;
const { Dragger } = Upload;

interface InputPanelProps {
  onGenerate: (prompt: string, model: string, files: File[]) => void;
  onAdjust?: (prompt: string) => void;
  onCodeTransform?: (sourceCode: string, instruction: string) => void;
  onImageToCode?: (imageFile: File, instruction: string) => void;
  isProcessing: boolean;
  hasCode: boolean;
  generatedCode?: string;
  generatedNodes?: Array<{ label: string; type: string }>;
}

const models = [
  { value: 'chatgpt5.5', label: 'chatgpt5.5' },
  { value: 'gemini3.5', label: 'gemini3.5' },
  { value: 'deepseekv4', label: 'deepSeekV4' },
];

const modelPointCost: Record<string, number> = {
  'chatgpt5.5': 26,
  'gemini3.5': 32,
  deepseekv4: 18,
};

interface FileEntry {
  file: File;
  previewUrl: string | null;
}

interface MockChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  nodeSummary?: string;
  pending?: boolean;
}

/** 4 fixed format-labeled upload slots */
const FIXED_SLOTS = [
  { key: 'svg', label: 'SVG', accept: '.svg', icon: '◰' },
  { key: 'txt', label: 'TXT', accept: '.txt,.csv,.xlsx,.xls', icon: '≡' },
  { key: 'obj', label: 'OBJ', accept: '.obj,.glb,.gltf', icon: '◻' },
  { key: 'mp4', label: 'MP4', accept: '.mp4,.webm', icon: '▶' },
] as const;

type SlotKey = typeof FIXED_SLOTS[number]['key'];

export function InputPanel({
  onGenerate,
  onAdjust,
  onCodeTransform,
  onImageToCode,
  isProcessing,
  hasCode,
  generatedCode = '',
  generatedNodes = [],
}: InputPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [adjustPrompt, setAdjustPrompt] = useState('');
  const [model, setModel] = useState('chatgpt5.5');
  const [mockMessages, setMockMessages] = useState<MockChatMessage[]>([]);
  const [isMockThinking, setIsMockThinking] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [slotFiles, setSlotFiles] = useState<Record<SlotKey, FileEntry | null>>({
    svg: null, txt: null, obj: null, mp4: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // code-transform modal
  const [transformOpen, setTransformOpen] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [transformInstruction, setTransformInstruction] = useState('');

  // image-to-code modal
  const [imgToCodeOpen, setImgToCodeOpen] = useState(false);
  const [imgToCodeImage, setImgToCodeImage] = useState<File | null>(null);
  const [imgToCodePreview, setImgToCodePreview] = useState<string | null>(null);
  const [imgToCodeInstruction, setImgToCodeInstruction] = useState('');
  const lastDisplayedCodeRef = useRef('');

  useEffect(() => {
    if (!activeAssistantId || !generatedCode || generatedCode === lastDisplayedCodeRef.current) return;
    lastDisplayedCodeRef.current = generatedCode;
    const nodeSummary = generatedNodes.length > 0
      ? `Generated ${generatedNodes.length} nodes from code: ${generatedNodes.slice(0, 6).map((node) => node.label || node.type).join(', ')}`
      : 'Code generated. The canvas will sync from @node/@connect annotations.';
    setMockMessages((prev) => prev.map((item) => (
      item.id === activeAssistantId
        ? {
          ...item,
          content: 'Code generated and canvas nodes synced.',
          code: generatedCode,
          nodeSummary,
          pending: false,
        }
        : item
    )));
    setIsMockThinking(false);
    setActiveAssistantId(null);
  }, [activeAssistantId, generatedCode, generatedNodes]);

  // ---- slot file handlers ----

  const setSlotFile = useCallback((key: SlotKey, entry: FileEntry | null) => {
    setSlotFiles((prev) => {
      // revoke old preview URL
      if (prev[key]?.previewUrl) URL.revokeObjectURL(prev[key].previewUrl!);
      return { ...prev, [key]: entry };
    });
  }, []);

  const handleSlotClick = useCallback((key: SlotKey, accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) {
        const previewUrl = f.type.startsWith('image/') || f.type.startsWith('video/')
          ? URL.createObjectURL(f) : null;
        setSlotFile(key, { file: f, previewUrl });
      }
    };
    input.click();
  }, [setSlotFile]);

  const handleSlotDrop = useCallback((e: React.DragEvent, key: SlotKey) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const previewUrl = f.type.startsWith('image/') || f.type.startsWith('video/')
        ? URL.createObjectURL(f) : null;
      setSlotFile(key, { file: f, previewUrl });
    }
  }, [setSlotFile]);

  const handleSlotDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const removeSlotFile = useCallback((key: SlotKey) => {
    setSlotFile(key, null);
  }, [setSlotFile]);

  // collect all slot files for generation
  const collectAllFiles = useCallback((): File[] => {
    const result: File[] = [];
    for (const key of Object.keys(slotFiles) as SlotKey[]) {
      if (slotFiles[key]) result.push(slotFiles[key]!.file);
    }
    return result;
  }, [slotFiles]);

  // ---- panel drag & drop (for general file area) ----

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // try to match dropped files to slots by extension
      for (const f of Array.from(e.dataTransfer.files)) {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        for (const slot of FIXED_SLOTS) {
          if (slot.accept.includes(ext)) {
            const previewUrl = f.type.startsWith('image/') || f.type.startsWith('video/')
              ? URL.createObjectURL(f) : null;
            setSlotFile(slot.key, { file: f, previewUrl });
            break;
          }
        }
      }
    }
  }, [setSlotFile]);

  // ---- folder link ----

  const folderToSlots = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from('length' in newFiles ? newFiles : []);
    for (const f of arr) {
      if (!(f instanceof File)) continue;
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      for (const slot of FIXED_SLOTS) {
        if (slot.accept.includes(ext)) {
          const previewUrl = f.type.startsWith('image/') || f.type.startsWith('video/')
            ? URL.createObjectURL(f) : null;
          setSlotFile(slot.key, { file: f, previewUrl });
          break;
        }
      }
    }
  }, [setSlotFile]);

  // ---- generate / adjust / transform ----

  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isProcessing || isMockThinking) return;
    if (model === 'chatgpt5.5') {
      const now = Date.now();
      const assistantId = `assistant_${now}`;
      lastDisplayedCodeRef.current = generatedCode;
      setMockMessages((prev) => [
        ...prev,
        { id: `user_${now}`, role: 'user', content: trimmed },
        { id: assistantId, role: 'assistant', content: 'chatgpt5.5 is generating Three.js + GSAP code and parsing nodes...', pending: true },
      ]);
      setPrompt('');
      setIsMockThinking(true);
      setActiveAssistantId(assistantId);
      onGenerate(trimmed, model, collectAllFiles());
      return;
    }
    onGenerate(trimmed, model, collectAllFiles());
  };

  const handleAdjust = () => {
    if (!adjustPrompt.trim() || isProcessing || !onAdjust) return;
    onAdjust(adjustPrompt);
    setAdjustPrompt('');
  };

  const handleTransform = () => {
    if (!sourceCode.trim() || !transformInstruction.trim() || isProcessing || !onCodeTransform) return;
    onCodeTransform(sourceCode.trim(), transformInstruction.trim());
    setTransformOpen(false);
    setSourceCode('');
    setTransformInstruction('');
  };

  // ---- image-to-code ----

  const handleImgToCode = () => {
    if (!imgToCodeImage || !imgToCodeInstruction.trim() || isProcessing || !onImageToCode) return;
    onImageToCode(imgToCodeImage, imgToCodeInstruction.trim());
    setImgToCodeOpen(false);
    setImgToCodeImage(null);
    if (imgToCodePreview) { URL.revokeObjectURL(imgToCodePreview); }
    setImgToCodePreview(null);
    setImgToCodeInstruction('');
  };

  const handleImgDrop = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      message.warning('请上传图片文件');
      return false;
    }
    setImgToCodeImage(file);
    setImgToCodePreview(URL.createObjectURL(file));
    return false; // prevent default upload behavior
  }, []);

  const hasAnyFile = Object.values(slotFiles).some((f) => f !== null);

  return (
    <div
      className={`${styles.panel} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 4 fixed format-labeled upload slots */}
      <div className={styles.fileSlots}>
        {FIXED_SLOTS.map((slot) => {
          const entry = slotFiles[slot.key];
          return (
            <div
              key={slot.key}
              className={`${styles.fileSlot} ${entry ? styles.fileSlotFilled : ''}`}
              onClick={() => !entry && handleSlotClick(slot.key, slot.accept)}
              onDrop={(e) => handleSlotDrop(e, slot.key)}
              onDragOver={handleSlotDragOver}
              title={entry ? entry.file.name : `点击或拖拽上传 ${slot.label} 文件`}
            >
              {entry ? (
                <div className={styles.filePreview}>
                  {entry.previewUrl ? (
                    entry.file.type.startsWith('video/') ? (
                      <video src={entry.previewUrl} className={styles.thumb} muted />
                    ) : (
                      <img src={entry.previewUrl} alt={entry.file.name} className={styles.thumb} />
                    )
                  ) : (
                    <div className={styles.fileIcon}>{slot.icon}</div>
                  )}
                  <div className={styles.fileName}>{entry.file.name.slice(0, 10)}</div>
                  <div
                    className={styles.removeBtn}
                    onClick={(e) => { e.stopPropagation(); removeSlotFile(slot.key); }}
                  >
                    ×
                  </div>
                </div>
              ) : (
                <span className={styles.slotLabel}>{slot.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 文件夹链接 */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore webkitdirectory is widely supported
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            folderToSlots(e.target.files);
          }
          e.target.value = '';
        }}
      />

      <div className={styles.folderRow}>
        <Tooltip title="链接本地 data 文件夹（批量导入）">
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            className={styles.folderBtn}
            onClick={() => folderInputRef.current?.click()}
          >
            文件夹链接
          </Button>
        </Tooltip>
        {hasAnyFile && (
          <span className={styles.fileCount}>
            {Object.values(slotFiles).filter(Boolean).length} 个文件已就绪
          </span>
        )}
      </div>

      {/* 图生代码按钮 */}
      {onImageToCode && (
        <div className={styles.folderRow}>
          <Tooltip title="上传图片，AI 根据图片生成代码">
            <Button
              size="small"
              icon={<FileImageOutlined />}
              className={styles.imgToCodeBtn}
              onClick={() => setImgToCodeOpen(true)}
            >
              图生代码
            </Button>
          </Tooltip>
        </div>
      )}

      {/* 图生代码弹窗 */}
      <Modal
        title="图生代码"
        open={imgToCodeOpen}
        onCancel={() => {
          setImgToCodeOpen(false);
          setImgToCodeImage(null);
          if (imgToCodePreview) { URL.revokeObjectURL(imgToCodePreview); }
          setImgToCodePreview(null);
          setImgToCodeInstruction('');
        }}
        onOk={handleImgToCode}
        okText="开始生成"
        cancelText="取消"
        width={650}
        confirmLoading={isProcessing}
        okButtonProps={{ disabled: !imgToCodeImage || !imgToCodeInstruction.trim() }}
        destroyOnClose
      >
        <div className={styles.transformBody}>
          <div className={styles.transformSection}>
            <div className={styles.transformLabel}>上传参考图片</div>
            <Dragger
              accept="image/*"
              showUploadList={false}
              beforeUpload={handleImgDrop}
              className={styles.imgDropZone}
            >
              {imgToCodePreview ? (
                <img src={imgToCodePreview} alt="preview" className={styles.imgPreview} />
              ) : (
                <div className={styles.imgDropPlaceholder}>
                  <InboxOutlined style={{ fontSize: 36, color: '#bfbfbf' }} />
                  <p className={styles.imgDropHint}>点击或拖拽图片到此区域</p>
                </div>
              )}
            </Dragger>
            {imgToCodeImage && (
              <div className={styles.imgFileName}>{imgToCodeImage.name}</div>
            )}
          </div>
          <div className={styles.transformSection}>
            <div className={styles.transformLabel}>生成指令（描述你想要的代码效果）</div>
            <TextArea
              value={imgToCodeInstruction}
              onChange={(e) => setImgToCodeInstruction(e.target.value)}
              placeholder="例如：生成这个图片的Three.js 3D版本、参考这个配色方案生成几何动画..."
              rows={3}
              className={styles.transformTextarea}
            />
          </div>
        </div>
      </Modal>

      {/* 代码生代码按钮 */}
      {onCodeTransform && (
        <div className={styles.folderRow}>
          <Tooltip title="粘贴已有代码并让AI基于此生成新代码">
            <Button
              size="small"
              icon={<SwapOutlined />}
              className={styles.transformBtn}
              onClick={() => setTransformOpen(true)}
            >
              代码生代码
            </Button>
          </Tooltip>
        </div>
      )}

      {/* 代码生代码弹窗 */}
      <Modal
        title="代码生代码"
        open={transformOpen}
        onCancel={() => setTransformOpen(false)}
        onOk={handleTransform}
        okText="开始生成"
        cancelText="取消"
        width={700}
        confirmLoading={isProcessing}
        okButtonProps={{ disabled: !sourceCode.trim() || !transformInstruction.trim() }}
        destroyOnClose
      >
        <div className={styles.transformBody}>
          <div className={styles.transformSection}>
            <div className={styles.transformLabel}>源代码（粘贴需要转化的代码）</div>
            <TextArea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="在此粘贴需要转化的代码..."
              rows={12}
              className={styles.transformTextarea}
            />
          </div>
          <div className={styles.transformSection}>
            <div className={styles.transformLabel}>转化指令（描述你想要的修改）</div>
            <TextArea
              value={transformInstruction}
              onChange={(e) => setTransformInstruction(e.target.value)}
              placeholder="例如：把这段代码改成蓝色主题、添加粒子效果、转换成Three.js格式..."
              rows={3}
              className={styles.transformTextarea}
            />
          </div>
        </div>
      </Modal>

      {/* 生成行 */}
      {mockMessages.length > 0 && (
        <div className={styles.mockChatLog}>
          {mockMessages.slice(-6).map((item) => (
            <div
              key={item.id}
              className={`${styles.mockChatBubble} ${item.role === 'user' ? styles.mockChatUser : styles.mockChatAssistant}`}
            >
              <span>{item.content}</span>
              {item.nodeSummary && <small>{item.nodeSummary}</small>}
              {item.code && <pre>{item.code}</pre>}
              {item.pending && <i />}
            </div>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想创作的艺术效果，例如：一个旋转的彩色立方体，背景是星空..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          className={styles.textInput}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />

        <div className={styles.generateControls}>
          <Select
            value={model}
            onChange={setModel}
            options={models}
            size="middle"
            className={styles.modelSelect}
          />
          <div className={styles.pointCost} title="本次生成预计消耗积分">
            <ThunderboltOutlined />
            <span>{modelPointCost[model]}</span>
          </div>
          <Button
            type="primary"
            onClick={handleGenerate}
            loading={isProcessing || isMockThinking}
            disabled={isProcessing || isMockThinking}
            className={styles.generateBtn}
            aria-label="发送生成指令"
          >
            ↑
          </Button>
        </div>
      </div>

      {/* 调整行 */}
      {hasCode && onAdjust && (
        <div className={styles.adjustRow}>
          <TextArea
            value={adjustPrompt}
            onChange={(e) => setAdjustPrompt(e.target.value)}
            placeholder="调整指令，例如：把立方体变成红色、加速旋转、添加粒子效果..."
            autoSize={{ minRows: 1, maxRows: 2 }}
            className={styles.adjustInput}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleAdjust();
              }
            }}
          />
          <Button
            type="default"
            icon={<ToolOutlined />}
            onClick={handleAdjust}
            loading={isProcessing}
            disabled={!adjustPrompt.trim()}
            className={styles.adjustBtn}
          >
            调整
          </Button>
        </div>
      )}
    </div>
  );
}
