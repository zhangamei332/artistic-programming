import { useState, useCallback, useEffect, useMemo } from 'react';
import { Input, Tooltip } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AudioOutlined,
  AimOutlined,
  BgColorsOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CodeOutlined,
  FontSizeOutlined,
  MenuOutlined,
  PictureOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  ScissorOutlined,
  SearchOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { MOTION_WAVEFORMS } from '../../utils/motionWaveforms';
import { CREATIVE_ALGORITHMS, type CreativeAlgorithmCatalogItem } from '../../features/creative-algorithms/catalog';
import { listPersonalTemplates, listTemplates } from '../../features/creative-node-templates/templateRegistry';
import { resolveTemplateNodeType } from '../../features/creative-node-templates/templateNodeTypeAliases';
import type { CreativeTemplate } from '../../features/creative-node-templates/templateTypes';
import styles from './NodeToolbox.module.css';

const fileMenuItems = [
  { key: 'text', label: '文本', icon: <MenuOutlined /> },
  { key: 'codeTest', label: '代码测试', icon: <CodeOutlined /> },
  { key: 'typography.textEditor', label: '文字编辑 / 转 SVG', icon: <FontSizeOutlined /> },
  { key: 'image', label: '图片', icon: <PictureOutlined /> },
  { key: 'image.smartCutout', label: '一键抠图', icon: <ScissorOutlined /> },
  { key: 'vector.svgEditor', label: 'SVG 编辑器', icon: <ScissorOutlined /> },
  { key: 'asset_vector', label: '矢量图形', icon: <ScissorOutlined /> },
  { key: 'utility.batchRename', label: '批量重命名', icon: <CodeOutlined /> },
  { key: 'asset_data', label: '数据', icon: <CodeOutlined /> },
  { key: 'asset_model3d', label: '3D模型', icon: <ApartmentOutlined /> },
  { key: 'particles', label: '粒子', icon: <RocketOutlined /> },
  { key: 'asset_audio', label: '音频', icon: <AudioOutlined /> },
];

const fontMenuItem = { key: 'file_font', label: '字体', icon: <FontSizeOutlined /> };

const utilityToolItems = [
  { key: 'typography.textEditor', label: '文字编辑 / 转 SVG', icon: <FontSizeOutlined /> },
  { key: 'utility.batchRename', label: '批量重命名', icon: <MenuOutlined /> },
  { key: 'image.smartCutout', label: '一键抠图', icon: <ScissorOutlined /> },
  { key: 'vector.svgEditor', label: 'SVG 编辑器', icon: <ScissorOutlined /> },
];

const interactionMenuItems = [
  { key: 'faceRecognition', label: '人脸识别', icon: <UserOutlined />, badges: ['代码', '数据'] },
  { key: 'gesture', label: '手势识别', icon: <VideoCameraOutlined />, badges: ['代码', '数据'] },
  { key: 'mouse', label: '鼠标交互', icon: <AimOutlined />, badges: ['代码', '数据'] },
  { key: 'keyboard', label: '键盘交互', icon: <MenuOutlined />, badges: ['代码', '数据'] },
];

const motionWaveformLabels: Record<string, string> = {
  sine: '正弦波',
  pulse: '脉冲波',
  saw: '锯齿波',
  ramp: '斜坡',
  triangle: '三角波',
  noise: '噪波',
  spring: '弹簧衰减振荡',
  collPulse: '密集脉冲',
  constant: '恒定值',
};

function getMotionWaveformLabel(id: string, fallback: string): string {
  return motionWaveformLabels[id] || fallback;
}

function isPersonalTemplate(template: CreativeTemplate): boolean {
  return template.id.startsWith('personal-') || !!template.tags?.includes('personal');
}

export function NodeToolbox() {
  const [expanded, setExpanded] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [personalTemplates, setPersonalTemplates] = useState<CreativeTemplate[]>(() => listPersonalTemplates());
  const [searchText, setSearchText] = useState('');

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string, label?: string, params?: Record<string, unknown>) => {
      const nodeLabel = label || nodeType;
      event.dataTransfer.setData(
        'application/reactflow',
        JSON.stringify({ nodeType, label: nodeLabel, params }),
      );
      event.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const addNodeFromMenu = useCallback((nodeType: string, label: string, params?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('node-toolbox-add-node', {
      detail: { nodeType, label, params },
    }));
    setAddMenuOpen(false);
    setStyleMenuOpen(false);
    setTemplateMenuOpen(false);
  }, []);

  const createStyleNodeParams = useCallback((item: CreativeAlgorithmCatalogItem) => ({
    algorithmId: item.id,
    algorithmName: item.name,
    category: item.category,
    categoryLabel: item.categoryLabel,
    preview: item.preview,
    entry: item.entry,
    pack: item.pack,
    outputs: 'Canvas / Texture / ImageBitmap',
  }), []);

  const addStyleNode = useCallback((item: CreativeAlgorithmCatalogItem) => {
    addNodeFromMenu('creative-algorithm', item.name, createStyleNodeParams(item));
  }, [addNodeFromMenu, createStyleNodeParams]);

  const onStyleDragStart = useCallback((event: React.DragEvent, item: CreativeAlgorithmCatalogItem) => {
    onDragStart(event, 'creative-algorithm', item.name, createStyleNodeParams(item));
  }, [createStyleNodeParams, onDragStart]);

  useEffect(() => {
    const refreshPersonalTemplates = () => setPersonalTemplates(listPersonalTemplates());
    window.addEventListener('creative-template-library-changed', refreshPersonalTemplates);
    window.addEventListener('storage', refreshPersonalTemplates);
    return () => {
      window.removeEventListener('creative-template-library-changed', refreshPersonalTemplates);
      window.removeEventListener('storage', refreshPersonalTemplates);
    };
  }, []);

  const builtInTemplates = useMemo(() => listTemplates(), []);
  const templates = useMemo(() => [...personalTemplates, ...builtInTemplates].sort((a, b) => Number(isPersonalTemplate(b)) - Number(isPersonalTemplate(a))), [builtInTemplates, personalTemplates]);
  const templateStatuses = useMemo(() => new Map(templates.map((template) => {
    const canUseDirectTypes = isPersonalTemplate(template);
    const missing = Array.from(new Set(template.graph.nodes.map((node) => node.type)))
      .filter((semanticType) => !resolveTemplateNodeType(semanticType) && !canUseDirectTypes);
    return [template.id, missing];
  })), [templates]);

  const insertTemplate = useCallback((template: CreativeTemplate) => {
    window.dispatchEvent(new CustomEvent('creative-template-insert', {
      detail: { templateId: template.id },
    }));
    setStyleMenuOpen(false);
    setTemplateMenuOpen(false);
  }, []);

  return (
    <div className={styles.toolbox}>
      <div className={styles.rail}>
        <Tooltip title={addMenuOpen ? '关闭添加菜单' : '添加节点'} placement="right">
          <button
            type="button"
            className={`${styles.primaryToolBtn} ${addMenuOpen ? styles.primaryToolBtnOpen : ''}`}
            aria-label={addMenuOpen ? '关闭添加菜单' : '添加节点'}
            onClick={() => {
              setAddMenuOpen((open) => !open);
              setExpanded(false);
              setStyleMenuOpen(false);
              setTemplateMenuOpen(false);
            }}
          >
            <PlusOutlined />
          </button>
        </Tooltip>
        <Tooltip title="打开工具箱" placement="right">
          <button
            type="button"
            className={`${styles.toolBtn} ${expanded ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setExpanded((open) => !open);
              setAddMenuOpen(false);
              setStyleMenuOpen(false);
              setTemplateMenuOpen(false);
            }}
          >
            <ApartmentOutlined />
          </button>
        </Tooltip>
        <Tooltip title="样式工具" placement="right">
          <button
            type="button"
            className={`${styles.toolBtn} ${styleMenuOpen ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setStyleMenuOpen((open) => !open);
              setExpanded(false);
              setAddMenuOpen(false);
              setTemplateMenuOpen(false);
            }}
          >
            <BgColorsOutlined />
          </button>
        </Tooltip>
        <Tooltip title="创意模板" placement="right">
          <button
            type="button"
            className={`${styles.toolBtn} ${templateMenuOpen ? styles.toolBtnActive : ''}`}
            onClick={() => {
              setTemplateMenuOpen((open) => !open);
              setExpanded(false);
              setAddMenuOpen(false);
              setStyleMenuOpen(false);
            }}
          >
            <AppstoreOutlined />
          </button>
        </Tooltip>
        <Tooltip title="历史记录" placement="right">
          <button type="button" className={styles.toolBtn}>
            <ClockCircleOutlined />
          </button>
        </Tooltip>
        <div className={styles.railDivider} />
        <Tooltip title="帮助" placement="right">
          <button type="button" className={styles.toolBtn}>
            <QuestionCircleOutlined />
          </button>
        </Tooltip>
      </div>

      {addMenuOpen && (
        <div className={styles.addMenu}>
          <div className={`${styles.addMenuColumn} ${styles.addMenuColumnPrimary}`}>
            <div className={styles.addMenuTitle}>添加节点</div>
            {fileMenuItems.map((item) => (
              <button
                type="button"
                key={item.key}
                className={styles.addMenuItem}
                draggable
                onDragStart={(event) => onDragStart(event, item.key, item.label)}
                onClick={() => addNodeFromMenu(item.key, item.label)}
              >
                <span className={styles.addMenuIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              key={fontMenuItem.key}
              className={`${styles.addMenuItem} ${styles.fontMenuItem}`}
              draggable
              onDragStart={(event) => onDragStart(event, fontMenuItem.key, fontMenuItem.label)}
              onClick={() => addNodeFromMenu(fontMenuItem.key, fontMenuItem.label)}
            >
              <span className={styles.addMenuIcon}>{fontMenuItem.icon}</span>
              <span>{fontMenuItem.label}</span>
            </button>
          </div>
          <div className={styles.addMenuColumn}>
            <div className={styles.addMenuTitle}>交互节点</div>
            {interactionMenuItems.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`${styles.addMenuItem} ${styles.interactionMenuItem}`}
                draggable
                onDragStart={(event) => onDragStart(event, item.key, item.label)}
                onClick={() => addNodeFromMenu(item.key, item.label)}
              >
                <span className={styles.addMenuIcon}>{item.icon}</span>
                <span>{item.label}</span>
                <span className={styles.addMenuBadges}>
                  {item.badges.map((badge) => <small key={badge}>{badge}</small>)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {styleMenuOpen && (
        <div className={styles.stylePanel}>
          <div className={styles.panelHeader}>
            <span>样式工具箱</span>
            <button type="button" onClick={() => setStyleMenuOpen(false)} aria-label="关闭样式工具箱">
              <CloseOutlined />
            </button>
          </div>
          <div className={styles.stylePanelBody}>
            <div className={styles.styleGrid}>
              {CREATIVE_ALGORITHMS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={styles.styleCard}
                  draggable
                  onDragStart={(event) => onStyleDragStart(event, item)}
                  onClick={() => addStyleNode(item)}
                  title={`${item.name} / ${item.id}`}
                >
                  <img src={item.preview} alt={item.name} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.categoryLabel} · {item.pack}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {templateMenuOpen && (
        <div className={styles.stylePanel}>
          <div className={styles.panelHeader}>
            <span>创意模板</span>
            <small>{templates.length} 个组合模板</small>
            <button type="button" onClick={() => setTemplateMenuOpen(false)} aria-label="关闭创意模板">
              <CloseOutlined />
            </button>
          </div>
          <div className={styles.stylePanelBody}>
            <div className={styles.templateList}>
              {templates.map((template) => {
                const missing = templateStatuses.get(template.id) || [];
                const disabled = missing.length > 0;
                const personal = isPersonalTemplate(template);

                return (
                  <button
                    type="button"
                    key={template.id}
                    className={`${styles.templateItem} ${personal ? styles.templateItemPersonal : ''}`}
                    disabled={disabled}
                    onClick={() => insertTemplate(template)}
                    title={disabled ? `缺少：${missing.join(', ')}` : template.description}
                  >
                    <span className={styles.templateIcon}>{personal ? 'ME' : template.category.slice(0, 2).toUpperCase()}</span>
                    <span>
                      <strong>{template.name}</strong>
                      <small>{disabled ? `缺少：${missing.join('、')}` : `${personal ? '个人 · ' : ''}${template.graph.nodes.length} 节点 · ${template.graph.edges.length} 连线`}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {expanded && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>我的工具箱</span>
            <button type="button" onClick={() => setExpanded(false)} aria-label="关闭工具箱">
              <CloseOutlined />
            </button>
          </div>
          <div className={styles.searchBox}>
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="搜索节点"
              allowClear
              className={styles.searchInput}
            />
          </div>
          <div className={styles.panelBody}>
            <section className={styles.utilityToolboxSection}>
              <div className={styles.motionToolboxTitle}>常用工具节点</div>
              <div className={styles.utilityToolboxGrid}>
                {utilityToolItems.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={styles.utilityToolboxItem}
                    draggable
                    onDragStart={(event) => onDragStart(event, item.key, item.label)}
                    onClick={() => addNodeFromMenu(item.key, item.label)}
                  >
                    <span className={styles.addMenuIcon}>{item.icon}</span>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            </section>
            <section className={styles.motionToolboxSection}>
              <div className={styles.motionToolboxTitle}>运动方式</div>
              <div className={styles.motionToolboxGrid}>
                {MOTION_WAVEFORMS.map((item) => {
                  const label = getMotionWaveformLabel(item.id, item.label);

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={styles.motionToolboxItem}
                      draggable
                      onDragStart={(event) => onDragStart(event, 'animation', label, item.params)}
                      onClick={() => addNodeFromMenu('animation', label, item.params)}
                    >
                      <span className={styles.motionCurve}>
                        <svg viewBox="0 0 110 48" preserveAspectRatio="none" aria-hidden="true">
                          <path d={item.path} />
                        </svg>
                      </span>
                      <strong>{label}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
