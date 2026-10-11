import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Filter, ArrowRight, Archive, ArchiveRestore, CheckCircle2, AlertTriangle } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { searchPatients, archivePatient } from '../services/patientService';

const INITIAL_FILTERS = {
  sex: 'All',
  ageMin: '',
  ageMax: '',
  dateFrom: '',
  dateTo: '',
  overallCAD: 'All',
  LAD: 'All',
  LCX: 'All',
  RCA: 'All',
};

export default function SearchPatientPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [unarchivingId, setUnarchivingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Search on mount to show all patients initially
  useEffect(() => {
    doSearch();
  }, []);

  const doSearch = async (archivedOverride) => {
    setLoading(true);
    setSearched(true);
    try {
      const filterParams = { ...filters };
      if (filterParams.ageMin) filterParams.ageMin = Number(filterParams.ageMin);
      else delete filterParams.ageMin;
      if (filterParams.ageMax) filterParams.ageMax = Number(filterParams.ageMax);
      else delete filterParams.ageMax;
      if (!filterParams.dateFrom) delete filterParams.dateFrom;
      if (!filterParams.dateTo) delete filterParams.dateTo;
      // Use override value when toggling (state hasn't updated yet)
      const includeArchived = archivedOverride !== undefined ? archivedOverride : showArchived;
      if (includeArchived) filterParams.includeArchived = true;

      const data = await searchPatients(query, filterParams);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    doSearch();
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setQuery('');
    setShowArchived(false);
  };

  const handleToggleArchived = () => {
    const next = !showArchived;
    setShowArchived(next);
    doSearch(next);   // pass new value directly — state update is async
  };

  const handleUnarchivePatient = async (patientId) => {
    setUnarchivingId(patientId);
    try {
      await archivePatient(patientId, false);
      // Update local results so row reflects unarchived status immediately
      setResults((prev) =>
        prev.map((p) => (p.patientId === patientId ? { ...p, isArchived: false } : p))
      );
      setActionMessage({
        type: 'success',
        text: `Patient ${patientId} has been unarchived and restored to active records.`,
      });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err?.message || `Failed to unarchive patient ${patientId}. Please try again.`,
      });
    } finally {
      setUnarchivingId(null);
    }
  };

  const handleSelectPatient = (patientId) => {
    navigate(`/patient/${patientId}`);
  };

  const SelectFilter = ({ label, filterKey, options }) => (
    <div className="filter-group">
      <label className="filter-label">{label}</label>
      <select
        className="form-input form-select"
        value={filters[filterKey]}
        onChange={(e) => handleFilterChange(filterKey, e.target.value)}
        style={{ fontSize: 'var(--font-sm)' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <div className="search-layout">
        {/* Filters sidebar */}
        <aside>
          <div className="card search-filters">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={16} /> Filters
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>
                Clear all
              </button>
            </div>

            <div className="filter-group">
              <label className="filter-label">Registered Date From</label>
              <input
                type="date"
                className="form-input"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                style={{ fontSize: 'var(--font-sm)' }}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Registered Date To</label>
              <input
                type="date"
                className="form-input"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                style={{ fontSize: 'var(--font-sm)' }}
              />
            </div>

            <SelectFilter label="Overall CAD (Predicted)" filterKey="overallCAD" options={['All', 'Yes', 'No']} />
            <SelectFilter label="LAD Stenosis (Predicted)" filterKey="LAD" options={['All', 'Yes', 'No']} />
            <SelectFilter label="LCX Stenosis (Predicted)" filterKey="LCX" options={['All', 'Yes', 'No']} />
            <SelectFilter label="RCA Stenosis (Predicted)" filterKey="RCA" options={['All', 'Yes', 'No']} />
            <SelectFilter label="Sex" filterKey="sex" options={['All', 'Male', 'Female']} />

            <div className="filter-group">
              <label className="filter-label">Age Range</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Min"
                  value={filters.ageMin}
                  onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                  style={{ fontSize: 'var(--font-sm)' }}
                />
                <input
                  type="number"
                  className="form-input"
                  placeholder="Max"
                  value={filters.ageMax}
                  onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                  style={{ fontSize: 'var(--font-sm)' }}
                />
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSearch} style={{ marginTop: '8px' }}>
              Apply Filters
            </button>
          </div>
        </aside>

        {/* Search & Results */}
        <main>
          <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by Patient ID..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  id="search-patient-input"
                />
                {query && (
                  <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => setQuery('')}
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button type="submit" className="btn btn-primary" id="btn-search">
                <Search size={16} /> Search
              </button>
            </div>
          </form>

          {/* Action Message Banner */}
          {actionMessage && (
            <div
              id="search-action-message"
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: actionMessage.type === 'success' ? 'var(--color-success-bg, rgba(34,197,94,0.12))' : 'rgba(239,68,68,0.1)',
                border: actionMessage.type === 'success' ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(239,68,68,0.35)',
                color: actionMessage.type === 'success' ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{actionMessage.text}</span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setActionMessage(null)}
                style={{ width: '22px', height: '22px' }}
                aria-label="Dismiss message"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Results header row: title + archived toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, margin: 0 }}>
              Patients {results.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({results.length})</span>}
            </h2>

            {/* Show Archived toggle pill */}
            <button
              type="button"
              id="btn-toggle-archived"
              onClick={handleToggleArchived}
              title={showArchived ? 'Hide archived patients' : 'Show archived patients'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                border: showArchived
                  ? '1.5px solid var(--color-warning, #f59e0b)'
                  : '1.5px solid var(--border-color)',
                background: showArchived
                  ? 'rgba(245,158,11,0.12)'
                  : 'var(--bg-elevated)',
                color: showArchived
                  ? 'var(--color-warning, #f59e0b)'
                  : 'var(--text-secondary)',
                boxShadow: showArchived ? '0 0 8px rgba(245,158,11,0.18)' : 'none',
              }}
            >
              <Archive size={13} />
              {showArchived ? 'Hiding Archived' : 'Show Archived'}
              {/* Animated indicator dot */}
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: showArchived ? 'var(--color-warning, #f59e0b)' : 'var(--text-tertiary)',
                display: 'inline-block',
                transition: 'background 0.18s ease',
              }} />
            </button>
          </div>

          {loading && (
            <div className="loading-overlay">
              <div className="spinner spinner-lg" />
              <span>Searching patients...</span>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
              <p style={{ fontSize: 'var(--font-md)', marginBottom: '8px' }}>No matching patients found</p>
              <p style={{ fontSize: 'var(--font-sm)' }}>Try adjusting your search or filters.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="patient-list">
              {results.map((patient) => (
                <div
                  key={patient.patientId}
                  className="patient-row"
                  onClick={() => handleSelectPatient(patient.patientId)}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-md)' }}>{patient.patientId}</span>
                      {patient.isArchived && (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                          <Archive size={10} /> Archived
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Registered: {patient.registeredDate}
                      {patient.age && <span> · Age: {patient.age}</span>}
                      {patient.sex && <span> · {patient.sex}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {patient.isArchived && (
                      <button
                        id={`btn-unarchive-${patient.patientId}`}
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnarchivePatient(patient.patientId);
                        }}
                        disabled={unarchivingId === patient.patientId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: 'var(--font-xs)',
                          padding: '4px 10px',
                        }}
                        title="Unarchive patient and restore to active records"
                      >
                        {unarchivingId === patient.patientId ? (
                          <>
                            <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                            Unarchiving...
                          </>
                        ) : (
                          <>
                            <ArchiveRestore size={13} />
                            Unarchive
                          </>
                        )}
                      </button>
                    )}
                    {patient.hasAssessment && (
                      <span className="badge badge-info">Has Assessment</span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-sm)', color: 'var(--corvex-blue-500)', fontWeight: 500 }}>
                      More <ArrowRight size={15} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
