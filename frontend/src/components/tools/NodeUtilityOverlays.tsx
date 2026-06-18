import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  createDefaultTextDocument,
  FontAssetResolver,
  PaperPathDataAdapter,
  serializeTextPreviewSvg,
  setDefaultTextStyle,
  TextDocumentStore,
  TextEditorInspector,
  TextToSvgConverter,
  type TextDocument,
  type TextToSvgOptions,
} from '../../text-editor-v10';
import {
  createDefaultBatchRenameDocument,
  createDefaultRenameRule,
  createRenamedZip,
  processRenamePlan,
  type BatchRenameDocument,
  type RenameAsset,
  type RenameRule,
  type RenameRuleVariant,
} from '../../batch-rename-v11';
import {
  createDefaultSmartCutoutDocument,
  RembgWebAdapter,
  SmartCutoutProcessor,
  SmartCutoutWorkspace,
  type CutoutProgress,
  type ImageAssetLike,
  type SmartCutoutDocument,
  type SmartCutoutResult,
} from '../../smart-cutout-v12';
import type { SvgDocument } from '../../svg-editor-v9';
import styles from './NodeUtilityOverlays.module.css';

interface FontAsset {
  id: string;
  family: string;
  arrayBuffer: ArrayBuffer;
}

interface TextEditorToolOverlayProps {
  nodeId: string;
  initialDocument?: TextDocument;
  onClose(): void;
  onDocumentChange(document: TextDocument): void;
  onCreateSvg(document: SvgDocument, label: string): void;
}

const textConvertOptions: TextToSvgOptions = {
  mode: 'duplicate',
  groupByLine: true,
  groupByGlyph: true,
  mergeGlyphs: false,
  preserveFill: true,
  preserveStroke: true,
  outlineStroke: false,
  applyTransform: true,
  openSvgEditor: true,
};

export function TextEditorToolOverlay({
  nodeId,
  initialDocument,
  onClose,
  onDocumentChange,
  onCreateSvg,
}: TextEditorToolOverlayProps) {
  const store = useMemo(() => new TextDocumentStore(initialDocument ?? createDefaultTextDocument('输入文字')), [initialDocument]);
  const [document, setDocument] = useState(store.getSnapshot());
  const [fonts, setFonts] = useState<FontAsset[]>([]);
  const [status, setStatus] = useState('请选择字体文件后可转换为 SVG 轮廓');
  const pathAdapter = useMemo(() => new PaperPathDataAdapter(), []);

  useEffect(() => {
    return store.subscribe((next) => {
      setDocument(next);
      onDocumentChange(next);
    });
  }, [onDocumentChange, store]);

  useEffect(() => () => pathAdapter.dispose(), [pathAdapter]);

  const uploadFont = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const family = file.name.replace(/\.(ttf|otf)$/iu, '');
    const font: FontAsset = {
      id: `font_${Date.now()}`,
      family,
      arrayBuffer,
    };
    setFonts((current) => [...current, font]);
    store.apply(setDefaultTextStyle({ fontAssetId: font.id, fontFamily: family }));
    setStatus(`已载入字体：${family}`);
    event.target.value = '';
  };

  const convertToSvg = async (options: TextToSvgOptions = textConvertOptions) => {
    try {
      const assetId = document.defaultStyle.fontAssetId;
      if (!assetId) {
        setStatus('转换前必须选择可解析的 TTF/OTF 字体文件');
        return;
      }
      const resolver = new FontAssetResolver({
        async getFontAsset(id) {
          return fonts.find((font) => font.id === id);
        },
      });
      const font = await resolver.load(assetId);
      const result = new TextToSvgConverter(pathAdapter).convert(document, font, options);
      onCreateSvg(result.svgDocument as SvgDocument, `${document.text.slice(0, 12) || '文字'} SVG`);
      setStatus(`已转换 ${result.glyphCount} 个字形 / ${result.pathCount} 条路径`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '文字转 SVG 失败');
    }
  };

  return (
    <div className={styles.overlay} data-selection-ui="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <strong>文字编辑与转 SVG</strong>
            <span>{nodeId}</span>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <div className={styles.textLayout}>
          <div className={styles.previewPane}>
            <label className={styles.uploadButton}>
              导入字体
              <input type="file" accept=".ttf,.otf,font/ttf,font/otf" onChange={uploadFont} />
            </label>
            <div className={styles.textPreview} dangerouslySetInnerHTML={{ __html: serializeTextPreviewSvg(document) }} />
            <div className={styles.status}>{status}</div>
          </div>
          <TextEditorInspector
            document={document}
            store={store}
            availableFonts={fonts.map((font) => ({ id: font.id, family: font.family }))}
            onConvertToSvg={convertToSvg}
          />
        </div>
      </div>
    </div>
  );
}

interface BatchRenameToolOverlayProps {
  nodeId: string;
  initialDocument?: BatchRenameDocument;
  onClose(): void;
  onApply(document: BatchRenameDocument, assets: RenameAsset[]): void;
}

const ruleLabels: Record<RenameRuleVariant, string> = {
  findReplace: '查找替换',
  regexReplace: '正则替换',
  prefix: '添加前缀',
  suffix: '添加后缀',
  insert: '插入文字',
  remove: '删除字符',
  sequence: '序列编号',
  caseStyle: '大小写',
  extension: '扩展名',
  dateTime: '日期时间',
  cleanup: '清理文件名',
  template: '模板重命名',
};

export function BatchRenameToolOverlay({ nodeId, initialDocument, onClose, onApply }: BatchRenameToolOverlayProps) {
  const [document, setDocument] = useState<BatchRenameDocument>(initialDocument ?? createDefaultBatchRenameDocument());
  const [assets, setAssets] = useState<RenameAsset[]>([]);
  const [status, setStatus] = useState('上传文件后添加规则预览重命名结果');
  const plan = useMemo(() => processRenamePlan(assets, document), [assets, document]);

  const updateDocument = (mutate: (next: BatchRenameDocument) => void) => {
    setDocument((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
  };

  const uploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setAssets(files.map((file, index) => ({
      id: `asset_${Date.now()}_${index}`,
      originalName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      mimeType: file.type,
      selected: true,
      sourceFile: file,
    })));
    event.target.value = '';
  };

  const addRule = (variant: RenameRuleVariant) => {
    updateDocument((next) => {
      next.rules.push(createDefaultRenameRule(variant));
    });
  };

  const patchRule = (id: string, patch: Partial<RenameRule>) => {
    updateDocument((next) => {
      const index = next.rules.findIndex((rule) => rule.id === id);
      if (index >= 0) next.rules[index] = { ...next.rules[index], ...patch } as RenameRule;
    });
  };

  const execute = async () => {
    onApply(document, assets);
    if (document.executionMode === 'zip') {
      try {
        const result = await createRenamedZip(plan);
        const anchor = window.document.createElement('a');
        anchor.href = URL.createObjectURL(result.blob);
        anchor.download = result.fileName;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        setStatus(`已导出 ZIP：${result.fileName}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'ZIP 导出失败');
      }
      return;
    }
    setStatus(`已写回 ${plan.changedCount} 个虚拟重命名结果`);
  };

  return (
    <div className={styles.overlay} data-selection-ui="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <strong>批量重命名</strong>
            <span>{nodeId}</span>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <div className={styles.renameGrid}>
          <section className={styles.toolSection}>
            <label className={styles.uploadButton}>
              导入文件
              <input type="file" multiple onChange={uploadFiles} />
            </label>
            <select defaultValue="" onChange={(event) => {
              if (!event.target.value) return;
              addRule(event.target.value as RenameRuleVariant);
              event.target.value = '';
            }}>
              <option value="">添加规则</option>
              {Object.entries(ruleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={document.executionMode} onChange={(event) => updateDocument((next) => {
              next.executionMode = event.target.value as BatchRenameDocument['executionMode'];
            })}>
              <option value="virtual">虚拟重命名</option>
              <option value="zip">导出 ZIP 副本</option>
              <option value="directExperimental">直接改本地文件（仅接口）</option>
            </select>
            <div className={styles.ruleList}>
              {document.rules.map((rule) => (
                <RuleEditor key={rule.id} rule={rule} onChange={(patch) => patchRule(rule.id, patch)} onRemove={() => {
                  updateDocument((next) => {
                    next.rules = next.rules.filter((item) => item.id !== rule.id);
                  });
                }} />
              ))}
            </div>
          </section>
          <section className={styles.toolSection}>
            <div className={styles.status}>
              {plan.selectedCount} 个文件，{plan.changedCount} 个改名，{plan.invalidCount} 个问题
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>原名称</th><th>新名称</th><th>状态</th></tr></thead>
                <tbody>
                  {plan.entries.slice(0, 80).map((entry) => (
                    <tr key={entry.assetId}>
                      <td>{entry.originalName}</td>
                      <td>{entry.outputName}</td>
                      <td>{entry.valid ? '正常' : entry.issues.map((issue) => issue.message).join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.status}>{status}</div>
            <button type="button" disabled={!plan.canExecute} onClick={execute}>执行重命名计划</button>
          </section>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange, onRemove }: { rule: RenameRule; onChange(patch: Partial<RenameRule>): void; onRemove(): void }) {
  return (
    <article className={styles.ruleCard}>
      <header>
        <label><input type="checkbox" checked={rule.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />{ruleLabels[rule.variant]}</label>
        <button type="button" onClick={onRemove}>删除</button>
      </header>
      {rule.variant === 'findReplace' && (
        <FieldPair a="查找" av={rule.find} b="替换为" bv={rule.replace} onA={(find) => onChange({ find })} onB={(replace) => onChange({ replace })} />
      )}
      {rule.variant === 'regexReplace' && (
        <FieldPair a="正则" av={rule.pattern} b="替换为" bv={rule.replacement} onA={(pattern) => onChange({ pattern })} onB={(replacement) => onChange({ replacement })} />
      )}
      {(rule.variant === 'prefix' || rule.variant === 'suffix') && (
        <label>文本<input value={rule.text} onChange={(event) => onChange({ text: event.target.value })} /></label>
      )}
      {rule.variant === 'sequence' && (
        <FieldPair a="起始" av={String(rule.start)} b="位数" bv={String(rule.padding)} onA={(start) => onChange({ start: Number(start) })} onB={(padding) => onChange({ padding: Number(padding) })} />
      )}
      {rule.variant === 'template' && (
        <label>模板<input value={rule.template} onChange={(event) => onChange({ template: event.target.value })} /></label>
      )}
      {rule.variant === 'caseStyle' && (
        <select value={rule.style} onChange={(event) => onChange({ style: event.target.value as typeof rule.style })}>
          <option value="uppercase">大写</option>
          <option value="lowercase">小写</option>
          <option value="titleCase">标题式</option>
          <option value="snakeCase">下划线</option>
          <option value="kebabCase">短横线</option>
        </select>
      )}
      {rule.variant === 'cleanup' && <span>清理空格、重复分隔符和非法字符</span>}
    </article>
  );
}

function FieldPair({ a, av, b, bv, onA, onB }: { a: string; av: string; b: string; bv: string; onA(value: string): void; onB(value: string): void }) {
  return (
    <div className={styles.fieldPair}>
      <label>{a}<input value={av} onChange={(event) => onA(event.target.value)} /></label>
      <label>{b}<input value={bv} onChange={(event) => onB(event.target.value)} /></label>
    </div>
  );
}

interface SmartCutoutToolOverlayProps {
  nodeId: string;
  initialDocument?: SmartCutoutDocument;
  onClose(): void;
  onApply(document: SmartCutoutDocument, result: SmartCutoutResult | null, sourceName?: string): void;
}

export function SmartCutoutToolOverlay({ nodeId, initialDocument, onClose, onApply }: SmartCutoutToolOverlayProps) {
  const [document, setDocument] = useState<SmartCutoutDocument>(initialDocument ?? createDefaultSmartCutoutDocument());
  const [asset, setAsset] = useState<ImageAssetLike | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [progress, setProgress] = useState<CutoutProgress>({ stage: 'idle', progress: 0, message: '等待图片' });
  const processorRef = useRef<SmartCutoutProcessor | null>(null);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    void processorRef.current?.dispose();
  }, [resultUrl, sourceUrl]);

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const id = `image_${Date.now()}`;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(URL.createObjectURL(file));
    setAsset({ id, name: file.name, mimeType: file.type, file });
    setDocument((current) => ({ ...current, sourceAssetId: id }));
    setProgress({ stage: 'idle', progress: 0, message: `已载入 ${file.name}` });
    event.target.value = '';
  };

  const runCutout = async () => {
    if (!asset) {
      setProgress({ stage: 'error', progress: 0, message: '请先导入图片' });
      return;
    }
    const processor = new SmartCutoutProcessor({
      backgroundRemoval: new RembgWebAdapter(),
      async resolveAsset(id) {
        return id === asset.id ? asset : undefined;
      },
    });
    processorRef.current = processor;
    try {
      const result = await processor.process(document, { onProgress: setProgress });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const url = URL.createObjectURL(result.transparentPng);
      setResultUrl(url);
      onApply(document, { ...result, objectUrl: url }, asset.name);
    } catch (error) {
      setProgress({ stage: 'error', progress: 0, message: error instanceof Error ? error.message : '一键抠图失败' });
      onApply(document, null, asset.name);
    }
  };

  return (
    <div className={styles.overlay} data-selection-ui="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <strong>一键抠图图像编辑</strong>
            <span>{nodeId}</span>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <div className={styles.cutoutGrid}>
          <section className={styles.toolSection}>
            <label className={styles.uploadButton}>
              导入图片
              <input type="file" accept="image/*" onChange={uploadImage} />
            </label>
            <label>模型
              <select value={document.inference.model} onChange={(event) => setDocument((current) => ({
                ...current,
                inference: { ...current.inference, model: event.target.value as SmartCutoutDocument['inference']['model'] },
              }))}>
                <option value="u2netp">u2netp 快速</option>
                <option value="u2net">u2net 标准</option>
                <option value="u2net_human_seg">人像</option>
                <option value="isnet-general-use">高质量</option>
                <option value="isnet-anime">动漫</option>
              </select>
            </label>
            <label>模型路径
              <input value={document.inference.modelBaseUrl} onChange={(event) => setDocument((current) => ({
                ...current,
                inference: { ...current.inference, modelBaseUrl: event.target.value },
              }))} />
            </label>
            <label>边缘羽化
              <input type="number" min={0} max={24} value={document.alpha.featherRadius} onChange={(event) => setDocument((current) => ({
                ...current,
                alpha: { ...current.alpha, featherRadius: Number(event.target.value) },
              }))} />
            </label>
            <label>背景
              <select value={document.background.mode} onChange={(event) => setDocument((current) => ({
                ...current,
                background: { ...current.background, mode: event.target.value as SmartCutoutDocument['background']['mode'] },
              }))}>
                <option value="transparent">透明</option>
                <option value="color">纯色</option>
              </select>
            </label>
            <button type="button" onClick={runCutout}>一键抠图</button>
            <div className={styles.status}>{progress.message}</div>
            <progress value={progress.progress} max={1} />
          </section>
          <section className={styles.cutoutWorkspace}>
            {sourceUrl ? (
              <SmartCutoutWorkspace sourceUrl={sourceUrl} document={document} onChange={setDocument} />
            ) : (
              <div className={styles.emptyState}>等待导入图片</div>
            )}
          </section>
          <section className={styles.cutoutResult}>
            {resultUrl ? <img src={resultUrl} alt="cutout result" /> : <div className={styles.emptyState}>等待输出透明 PNG</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
