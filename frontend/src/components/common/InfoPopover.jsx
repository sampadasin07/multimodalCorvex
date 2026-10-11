import { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

/**
 * Interactive Info Popover component for all features across the app.
 * Accessible via click and keyboard, with full details on expected data format,
 * units, normal ranges, and clinical definitions.
 */
export default function InfoPopover({ featureDef }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const getFormatBadge = () => {
    if (featureDef.type === 'boolean') {
      return <span className="info-badge info-badge-boolean">Binary: Yes / No</span>;
    }
    if (featureDef.type === 'numeric') {
      return (
        <span className="info-badge info-badge-numeric">
          Numerical {featureDef.unit ? `(${featureDef.unit})` : ''}
        </span>
      );
    }
    if (featureDef.type === 'select') {
      return <span className="info-badge info-badge-select">Dropdown Selection</span>;
    }
    return null;
  };

  return (
    <div className="info-popover-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`info-icon-btn ${isOpen ? 'active' : ''}`}
        onClick={toggle}
        aria-label={`Information for ${featureDef.label}`}
        aria-expanded={isOpen}
      >
        <Info size={14} />
      </button>

      {isOpen && (
        <div className="info-popover-card" role="dialog" aria-modal="false">
          <div className="info-popover-header">
            <div className="info-popover-title">
              {featureDef.label}
              {featureDef.key !== featureDef.label && (
                <span className="info-popover-code">({featureDef.key})</span>
              )}
            </div>
            <button
              type="button"
              className="info-popover-close"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              aria-label="Close information"
            >
              <X size={14} />
            </button>
          </div>

          <div className="info-popover-body">
            <div className="info-popover-tags">
              {getFormatBadge()}
              {featureDef.unit && (
                <span className="info-badge info-badge-unit">Unit: {featureDef.unit}</span>
              )}
            </div>

            <p className="info-popover-desc">
              {featureDef.description || featureDef.tooltip || `Clinical feature for ${featureDef.label}.`}
            </p>

            {featureDef.normalRange && (
              <div className="info-popover-meta">
                <span className="info-meta-label">Reference Range:</span>
                <span className="info-meta-val">{featureDef.normalRange}</span>
              </div>
            )}

            {featureDef.type === 'boolean' && (
              <div className="info-popover-instruction">
                <strong>Input type:</strong> Click <strong>Yes</strong> or <strong>No</strong> button to record status.
              </div>
            )}

            {featureDef.type === 'numeric' && (
              <div className="info-popover-instruction">
                <strong>Input type:</strong> Enter numerical digits {featureDef.unit ? `in ${featureDef.unit}` : ''}.
              </div>
            )}

            {featureDef.type === 'select' && featureDef.options && (
              <div className="info-popover-instruction">
                <strong>Available options:</strong> {featureDef.options.map((o) => o.label).join(', ')}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
