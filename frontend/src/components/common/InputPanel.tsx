import { useState, useRef, useCallback } from 'react';
import { Input, Button, Select, Tooltip, Modal, message, Upload } from 'antd';
import {
  ThunderboltOutlined,
  FolderOpenOutlined,
  SwapOutlined,
  FileImageOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { GenerationRequestEntry } from '../../hooks/useAutoFix';
import styles from './InputPanel.module.css';

const { TextArea } = Input;
const { Dragger } = Upload;

interface InputPanelProps {
  onGenerate: (prompt: string, model: string, files: File[]) => void;
  onAdjust?: (prompt: string) => void;
  onCodeTransform?: (sourceCode: string, instruction: string) => void;
  onImageToCode?: (imageFile: File, instruction: string, model?: string) => void;
  isProcessing: boolean;
  hasCode: boolean;
  requestLog?: GenerationRequestEntry[];
}

const models = [
  { value: 'deepseekv4', label: 'deepSeekV4' },
  { value: 'chatgpt5.5', label: 'chatgpt5.5' },
  { value: 'gemini3.5', label: 'gemini3.5' },
  { value: 'mimo-v2.5-pro', label: 'mimo-v2.5-pro' },
];

const modelPointCost: Record<string, number> = {
  'chatgpt5.5': 26,
  'gemini3.5': 32,
  'mimo-v2.5-pro': 26,
  deepseekv4: 18,
};

interface FileEntry {
  file: File;
  previewUrl: string | null;
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
  requestLog = [],
}: InputPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [adjustPrompt, setAdjustPrompt] = useState('');
  const [model, setModel] = useState('deepseekv4');
  const [slotFiles, setSlotFiles] = useState<Record<SlotKey, FileEntry | null>>({
    svg: null, txt: null, obj: null, mp4: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
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

  // ---- slot file handlers ----

  const setSlotFile = useCallback((key: SlotKey, entry: FileEntry | null) => {
    setSlotFiles((prev) => {
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

  const collectAllFiles = useCallback((): File[] => {
    const result: File[] = [];
    for (const key of Object.keys(slotFiles) as SlotKey[]) {
      if (slotFiles[key]) result.push(slotFiles[key]!.file);
    }
    return result;
  }, [slotFiles]);

  // ---- panel drag & drop ----

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
    if (!trimmed || isProcessing) return;
    setPrompt('');
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
    onImageToCode(imgToCodeImage, imgToCodeInstruction.trim(), model);
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
    return false;
  }, []);

  const hasAnyFile = Object.values(slotFiles).some((f) => f !== null);

  // API 进度提示文字
  const formatRequestTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  return (
    <div
      className={`${styles.panel} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {requestLog.length > 0 && (
        <div className={styles.requestList}>
          {requestLog.map((item) => {
            const expanded = expandedRequestId === item.id;
            return (
              <div
                key={item.id}
                className={`${styles.requestCard} ${item.status === 'active' ? styles.requestCardActive : ''} ${item.status === 'error' ? styles.requestCardError : ''}`}
                onClick={() => setExpandedRequestId((current) => (current === item.id ? null : item.id))}
              >
                <div className={styles.requestTop}>
                  <span>{item.model}</span>
                  <span>{formatRequestTime(item.timestamp)}</span>
                </div>
                <div className={styles.requestMessage}>{item.message}</div>
                <div className={styles.requestMeta}>
                  <span>{item.code.length} 字符</span>
                  <span>{expanded ? '收起代码' : '查看代码'}</span>
                </div>
                {expanded && (
                  <pre className={styles.requestCode}>{item.code || '正在等待代码返回...'}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}

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
        afterOpenChange={(open) => {
          if (!open) {
            setImgToCodeImage(null);
            if (imgToCodePreview) { URL.revokeObjectURL(imgToCodePreview); }
            setImgToCodePreview(null);
            setImgToCodeInstruction('');
          }
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
      <div className={styles.inputRow}>
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想创作的艺术效果，例如：一个旋转的彩色立方体，背景是星空..."
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
            loading={isProcessing}
            disabled={isProcessing}
            className={styles.generateBtn}
            aria-label="发送生成指令"
          >
            ↑
          </Button>
        </div>
      </div>
    </div>
  );
}
