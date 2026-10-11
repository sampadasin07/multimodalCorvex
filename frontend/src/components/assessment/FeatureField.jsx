import InfoPopover from '../common/InfoPopover';

/**
 * Numeric input field for assessment features
 */
export function NumericField({ featureDef, value, onChange, error }) {
  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label" htmlFor={`field-${featureDef.key}`}>
          <span className="form-label-text">
            {featureDef.label}
            {featureDef.required && <span className="required-star" style={{ color: 'var(--color-danger)', marginLeft: '4px', fontWeight: 'bold' }}>*</span>}
          </span>
          {featureDef.unit && (
            <span className="form-unit-pill">{featureDef.unit}</span>
          )}
        </label>
        <div className="form-label-actions">
          {featureDef.required && (
            <span className="form-field-badge required-pill" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
              Required *
            </span>
          )}
          <span className="form-field-badge numeric">Numeric</span>
          <InfoPopover featureDef={featureDef} />
        </div>
      </div>

      <div className="input-with-unit">
        <input
          id={`field-${featureDef.key}`}
          type="number"
          inputMode="decimal"
          className={`form-input ${error ? 'error' : ''}`}
          value={value !== null && value !== undefined ? value : ''}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(featureDef.key, raw === '' ? null : Number(raw));
          }}
          placeholder={featureDef.placeholder || (featureDef.unit ? `Enter in ${featureDef.unit}` : 'Enter numerical value')}
          step="any"
        />
        {featureDef.unit && (
          <span className="input-unit-addon">{featureDef.unit}</span>
        )}
      </div>

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

/**
 * Yes/No segmented control for boolean features
 */
export function BooleanField({ featureDef, value, onChange, error }) {
  const isUnanswered = value === null || value === undefined || value === '';

  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label">
          <span className="form-label-text">
            {featureDef.label}
            {featureDef.required && <span className="required-star" style={{ color: 'var(--color-danger)', marginLeft: '4px', fontWeight: 'bold' }}>*</span>}
          </span>
        </label>
        <div className="form-label-actions">
          {featureDef.required && (
            <span className="form-field-badge required-pill" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
              Required *
            </span>
          )}
          <span className="form-field-badge boolean">Yes / No</span>
          <InfoPopover featureDef={featureDef} />
        </div>
      </div>

      <div
        className={`segmented-control ${isUnanswered ? 'unanswered' : ''} ${error ? 'error' : ''}`}
        role="group"
        aria-label={`${featureDef.label} selection`}
      >
        <button
          type="button"
          className={`segmented-btn ${value === 'Yes' ? 'active active-yes' : ''}`}
          onClick={() => onChange(featureDef.key, 'Yes')}
        >
          Yes
        </button>
        <button
          type="button"
          className={`segmented-btn ${value === 'No' ? 'active active-no' : ''}`}
          onClick={() => onChange(featureDef.key, 'No')}
        >
          No
        </button>
      </div>

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

/**
 * Dropdown/select field
 */
export function SelectField({ featureDef, value, onChange, error }) {
  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label" htmlFor={`field-${featureDef.key}`}>
          <span className="form-label-text">
            {featureDef.label}
            {featureDef.required && <span className="required-star" style={{ color: 'var(--color-danger)', marginLeft: '4px', fontWeight: 'bold' }}>*</span>}
          </span>
        </label>
        <div className="form-label-actions">
          {featureDef.required && (
            <span className="form-field-badge required-pill" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}>
              Required *
            </span>
          )}
          <span className="form-field-badge select">Select</span>
          <InfoPopover featureDef={featureDef} />
        </div>
      </div>

      <select
        id={`field-${featureDef.key}`}
        className={`form-input form-select ${error ? 'error' : ''}`}
        value={value !== null && value !== undefined ? value : ''}
        onChange={(e) => onChange(featureDef.key, e.target.value || null)}
      >
        <option value="">{featureDef.placeholder || `Select ${featureDef.label.toLowerCase()}`}</option>
        {featureDef.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

/**
 * Render the appropriate field type based on feature definition
 */
export default function FeatureField({ featureDef, value, onChange, error }) {
  switch (featureDef.type) {
    case 'numeric':
      return <NumericField featureDef={featureDef} value={value} onChange={onChange} error={error} />;
    case 'boolean':
      return <BooleanField featureDef={featureDef} value={value} onChange={onChange} error={error} />;
    case 'select':
      return <SelectField featureDef={featureDef} value={value} onChange={onChange} error={error} />;
    default:
      return <NumericField featureDef={featureDef} value={value} onChange={onChange} error={error} />;
  }
}
