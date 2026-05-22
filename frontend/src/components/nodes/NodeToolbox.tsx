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
  { key: 'scene', nodes: ['scene', 'camera', 'renderer'] },
  { key: 'geometry', nodes: ['geometry', 'material', 'mesh'] },
  { key: 'light', nodes: ['ambientLight', 'directionalLight', 'pointLight'] },
  { key: 'control', nodes: ['transform', 'animation', 'controls', 'responsive'] },
  { key: 'effect', nodes: ['texture', 'particles', 'shader', 'color'] },
  { key: 'interaction', nodes: ['interaction'] },
  { key: 'drawing', nodes: [] }, // special: expandable sub-groups
];

// 2D drawing sub-groups with expandable sub-nodes
const drawingSubGroups = [
  { key: 'lineGrp', label: '直线', nodes: ['line'] },
  { key: 'rectGrp', label: '方形', nodes: ['rect2d', 'quad'] },
  { key: 'ellipseGrp', label: '圆形', nodes: ['ellipse2d', 'circle', 'arc'] },
  { key: 'curveGrp', label: '曲线', nodes: ['bezier', 'curve2d', 'vertex'] },
];

export function NodeToolbox() {
  const [expanded, setExpanded] = useState(true);
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(['scene', 'geometry', 'light', 'control', 'effect', 'interaction', 'drawing']),
  );
  const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(
    new Set(['lineGrp', 'rectGrp', 'ellipseGrp', 'curveGrp']),
  );

  const toggleCategory = useCallback((key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSubGroup = useCallback((key: string) => {
    setOpenSubGroups((prev) => {
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
                {cat.key === 'drawing' ? (
                  // 2D drawing: expandable sub-groups
                  drawingSubGroups.map((grp) => {
                    const grpOpen = openSubGroups.has(grp.key);
                    return (
                      <div key={grp.key} className={styles.subGroup}>
                        <div
                          className={styles.subGroupHeader}
                          onClick={() => toggleSubGroup(grp.key)}
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
                  })
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
