import { useState, useRef, useCallback } from 'react';
import { Input, Button, Select } from 'antd';
import { SendOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons';
import styles from './InputPanel.module.css';

const { TextArea } = Input;

interface InputPanelProps {
  onGenerate: (prompt: string, model: string) => void;
  onAdjust?: (prompt: string) => void;
  isProcessing: boolean;
  hasCode: boolean;
}

const models = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'gpt', label: 'GPT-4' },
];

const SUPPORTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.svg',
  '.txt', '.csv', '.xlsx', '.xls',
  '.mp4', '.webm',
  '.obj', '.glb', '.gltf',
];

interface FileEntry {
  file: File;
  previewUrl: string | null;
}

export function InputPanel({ onGenerate, onAdjust, isProcessing, hasCode }: InputPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [adjustPrompt, setAdjustPrompt] = useState('');
  const [model, setModel] = useState('deepseek');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = () => {
    if (!prompt.trim() || isProcessing) return;
    onGenerate(prompt, model);
  };

  const handleAdjust = () => {
    if (!adjustPrompt.trim() || isProcessing || !onAdjust) return;
    onAdjust(adjustPrompt);
    setAdjustPrompt('');
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: FileEntry[] = [];
    const arr = 'length' in newFiles ? Array.from(newFiles) : newFiles;
    for (const f of arr) {
      if (!(f instanceof File)) continue;
      let previewUrl: string | null = null;
      if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
        previewUrl = URL.createObjectURL(f);
      }
      entries.push({ file: f, previewUrl });
    }
    setFiles((prev) => {
      const merged = [...prev, ...entries];
      return merged.slice(0, 12); // max 12 files
    });
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => {
      const next = prev.slice();
      if (next[idx]?.previewUrl) URL.revokeObjectURL(next[idx].previewUrl!);
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const placeholderCount = Math.max(3, files.length + 1);
  const isCompact = files.length > 3;

  return (
    <div
      className={`${styles.panel} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 文件占位框 */}
      <div className={styles.fileSlots}>
        {Array.from({ length: placeholderCount }).map((_, idx) => {
          const entry = files[idx];
          return (
            <div
              key={idx}
              className={`${styles.fileSlot} ${isCompact ? styles.fileSlotCompact : ''} ${entry ? styles.fileSlotFilled : ''}`}
              onClick={!entry ? handleFileClick : undefined}
              title={entry ? entry.file.name : '点击选择文件或拖拽文件到此处'}
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
                    <div className={styles.fileIcon}>
                      {entry.file.name.endsWith('.obj') ? '◻' :
                       entry.file.name.endsWith('.xlsx') || entry.file.name.endsWith('.xls') ? '📊' :
                       entry.file.name.endsWith('.csv') ? '📄' :
                       entry.file.name.endsWith('.txt') ? '📝' : '📎'}
                    </div>
                  )}
                  <div className={styles.fileName}>{entry.file.name.slice(0, isCompact ? 8 : 16)}</div>
                  <div
                    className={styles.removeBtn}
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  >
                    ×
                  </div>
                </div>
              ) : (
                <PlusOutlined className={styles.plusIcon} />
              )}
            </div>
          );
        })}
      </div>

      {/* 支持格式提示 */}
      <div className={styles.formatHint}>
        支持格式：{SUPPORTED_EXTENSIONS.join(' ')}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SUPPORTED_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 生成行 */}
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

        <Select
          value={model}
          onChange={setModel}
          options={models}
          size="middle"
          className={styles.modelSelect}
        />

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleGenerate}
          loading={isProcessing}
          disabled={!prompt.trim()}
          className={styles.generateBtn}
        >
          生成
        </Button>
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
