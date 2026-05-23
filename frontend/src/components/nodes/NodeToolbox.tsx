import { useState, useCallback } from 'react';
import { DoubleRightOutlined, DoubleLeftOutlined } from '@ant-design/icons';
import { tdNodeTypes, categoryLabels } from './TDNodes';
import styles from './NodeToolbox.module.css';

const categoryIcons: Record<string, string> = {
  scene: '⬡',
  geometry: '◆',
  light: '✧',
  control: '◎',
  effect: '◉',
  interaction: '↗',
  drawing: '✎',
};

const categoryColors: Record<string, { header: string; dot: string }> = {
  scene: { header: styles.catScene, dot: styles.dotScene },
  geometry: { header: styles.catGeometry, dot: styles.dotGeometry },
  light: { header: styles.catLight, dot: styles.dotLight },
  control: { header: styles.catControl, dot: styles.dotControl },
  effect: { header: styles.catEffect, dot: styles.dotEffect },
  interaction: { header: styles.catInteraction, dot: styles.dotInteraction },
  drawing: { header: styles.catDrawing, dot: styles.dotDrawing },
};

type Category = 'scene' | 'geometry' | 'light' | 'control' | 'effect' | 'interaction' | 'drawing';

const categories: { key: Category; nodes: string[] }[] = [
  { key: 'drawing', nodes: ['line', 'rect2d', 'ellipse2d', 'circle', 'arc', 'bezier', 'curve2d', 'vertex', 'quad'] },
  { key: 'geometry', nodes: ['geometry', 'material', 'mesh'] },
  { key: 'effect', nodes: ['texture', 'particles', 'shader', 'color'] },
  { key: 'control', nodes: ['transform', 'animation', 'controls', 'responsive'] },
  { key: 'interaction', nodes: [
    'interaction', 'keyboard', 'mouse', 'gesture', 'camera_interaction',
    'audioRhythm', 'mp4Recognition', 'faceRecognition', 'hardware',
  ]},
  { key: 'light', nodes: ['ambientLight', 'directionalLight', 'pointLight'] },
  { key: 'scene', nodes: ['scene', 'camera', 'renderer'] },
];

// 交互层子分组
const interactionSubGroups = [
  { key: 'inputGrp', label: '输入设备', nodes: ['keyboard', 'mouse'] },
  { key: 'sensorGrp', label: '传感器', nodes: ['gesture', 'camera_interaction', 'audioRhythm'] },
  { key: 'visionGrp', label: '视觉识别', nodes: ['mp4Recognition', 'faceRecognition'] },
  { key: 'hardwareGrp', label: '外部硬件', nodes: ['hardware'] },
];

export function NodeToolbox() {
  const [expanded, setExpanded] = useState(true);
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(['scene', 'geometry', 'light', 'control', 'effect', 'interaction', 'drawing']),
  );
  const [openInteractionSubs, setOpenInteractionSubs] = useState<Set<string>>(
    new Set(['inputGrp', 'sensorGrp', 'visionGrp', 'hardwareGrp']),
  );

  const toggleCategory = useCallback((key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleInteractionSub = useCallback((key: string) => {
    setOpenInteractionSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      const label = tdNodeTypes[nodeType] || nodeType;
      event.dataTransfer.setData(
        'application/reactflow',
        JSON.stringify({ nodeType, label }),
      );
      event.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  return (
    <div className={`${styles.toolbox} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.toggleBtn} onClick={() => setExpanded(!expanded)}>
        {expanded ? <DoubleLeftOutlined /> : <DoubleRightOutlined />}
      </div>

      {categories.map((cat) => {
        const colors = categoryColors[cat.key];
        const isOpen = openCategories.has(cat.key);

        return (
          <div key={cat.key}>
            <div
              className={`${styles.categoryHeader} ${colors.header}`}
              onClick={() => toggleCategory(cat.key)}
            >
              {expanded ? (
                <span className={styles.expandedLabel}>
                  {categoryIcons[cat.key]} {categoryLabels[cat.key]}
                </span>
              ) : (
                <span className={styles.collapsedLabel}>
                  {categoryLabels[cat.key]}
                </span>
              )}
            </div>

            {expanded && isOpen && (
              <div className={styles.itemList}>
                {cat.key === 'interaction' ? (
                  // 交互层: expandable sub-groups
                  <>
                    {/* 基础交互 */}
                    <div
                      className={styles.dragItem}
                      draggable
                      onDragStart={(e) => onDragStart(e, 'interaction')}
                      title={tdNodeTypes['interaction']}
                    >
                      <span className={`${styles.dot} ${colors.dot}`} />
                      <span>{tdNodeTypes['interaction']}</span>
                    </div>
                    {interactionSubGroups.map((grp) => {
                      const grpOpen = openInteractionSubs.has(grp.key);
                      return (
                        <div key={grp.key} className={styles.subGroup}>
                          <div
                            className={styles.subGroupHeader}
                            onClick={() => toggleInteractionSub(grp.key)}
                          >
                            <span className={`${styles.subGroupArrow} ${grpOpen ? styles.subGroupArrowOpen : ''}`}>
                              ▶
                            </span>
                            <span>{grp.label}</span>
                          </div>
                          {grpOpen && (
                            <div className={styles.subItems}>
                              {grp.nodes.map((nt) => (
                                <div
                                  key={nt}
                                  className={styles.dragItem}
                                  draggable
                                  onDragStart={(e) => onDragStart(e, nt)}
                                  title={tdNodeTypes[nt] || nt}
                                >
                                  <span className={`${styles.dot} ${colors.dot}`} />
                                  <span>{tdNodeTypes[nt] || nt}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  cat.nodes.map((nt) => (
                    <div
                      key={nt}
                      className={styles.dragItem}
                      draggable
                      onDragStart={(e) => onDragStart(e, nt)}
                      title={tdNodeTypes[nt] || nt}
                    >
                      <span className={`${styles.dot} ${colors.dot}`} />
                      <span>{tdNodeTypes[nt] || nt}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
