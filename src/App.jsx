import { useEffect, useState, useCallback } from 'react';
import './App.css';

// In development, Vite proxy rewrites /api/niagara to tunnel
// In production (Vercel), /api/niagara serverless function proxies to Niagara
const API_BASE = '/api/niagara';

function useNiagaraApi() {
  const [config, setConfig] = useState(null);
  const [monitor, setMonitor] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [alarmCounts, setAlarmCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const apiFetch = useCallback(async (path) => {
    // Remove leading slash from path for query param
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const res = await fetch(API_BASE + '?path=' + encodeURIComponent(cleanPath));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const data = await apiFetch('/config');
      setConfig(data);
      setConnected(true);
      setError(null);
      return data;
    } catch (err) {
      setError('No se pudo conectar a Niagara: ' + err.message);
      setConnected(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const loadFloorData = useCallback(async (floorKey) => {
    try {
      const [monitorData, equipData] = await Promise.all([
        apiFetch('/monitor/' + floorKey),
        apiFetch('/equipment/' + floorKey),
      ]);
      setMonitor(monitorData);
      setEquipment(Array.isArray(equipData) ? equipData : []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error loading floor data:', err);
    }
  }, [apiFetch]);

  const loadAlarmCounts = useCallback(async () => {
    try {
      const data = await apiFetch('/alarms/counts');
      setAlarmCounts(data);
    } catch (err) {
      console.error('Error loading alarm counts:', err);
    }
  }, [apiFetch]);

  return {
    config, monitor, equipment, alarmCounts, loading, error, connected, lastUpdate,
    loadConfig, loadFloorData, loadAlarmCounts
  };
}

function StatCard({ value, label, colorClass }) {
  return (
    <div className="stat-card">
      <div className={'stat-value ' + (colorClass || '')}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EquipmentCard({ equip }) {
  // Status — values are flat booleans from Niagara BStatusBoolean
  let status = 'offline';
  let statusLabel = 'Offline';

  if (equip.alarm === true) {
    status = 'alarm';
    statusLabel = 'Alarma';
  } else if (equip.online === true) {
    if (equip.fanOn === true) {
      status = 'fan-on';
      statusLabel = 'Enfriando';
    } else {
      status = 'online';
      statusLabel = 'Standby';
    }
  }

  // Collect numeric properties to display (skip booleans and strings like tag/name)
  const skipKeys = ['online', 'fanOn', 'alarm', 'tag', 'equipName', 'location',
    'name', 'displayName', 'scheduleActive', 'scheduleOrd'];
  const props = [];
  Object.keys(equip).forEach(function (key) {
    if (skipKeys.indexOf(key) !== -1) return;
    const val = equip[key];
    if (typeof val === 'number') {
      props.push({ key: key, value: val });
    }
  });

  // Name: try tag, equipName, then fallback
  const name = equip.tag || equip.equipName || equip.name || 'Equipo';

  return (
    <div className="equipment-card">
      <div className="card-header">
        <h3>{name}</h3>
        <span className={'status-badge ' + status}>{statusLabel}</span>
      </div>
      {equip.location && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          {equip.location}
        </div>
      )}
      <div className="card-props">
        {props.slice(0, 6).map(function (p) {
          return (
            <div className="prop" key={p.key}>
              <span className="prop-label">{p.key}</span>
              <span className="prop-value">
                {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const {
    config, monitor, equipment, alarmCounts, loading, error, connected, lastUpdate,
    loadConfig, loadFloorData, loadAlarmCounts
  } = useNiagaraApi();

  const [activeFloor, setActiveFloor] = useState(null);

  // Initial load
  useEffect(function () {
    loadConfig().then(function (cfg) {
      if (cfg && cfg.floors && cfg.floors.length > 0) {
        setActiveFloor(cfg.floors[0].key);
      }
    }).catch(function () {});
  }, [loadConfig]);

  // Load floor data when active floor changes
  useEffect(function () {
    if (!activeFloor) return;
    loadFloorData(activeFloor);
    loadAlarmCounts();

    // Poll every 5 seconds
    const interval = setInterval(function () {
      loadFloorData(activeFloor);
      loadAlarmCounts();
    }, 5000);

    return function () { clearInterval(interval); };
  }, [activeFloor, loadFloorData, loadAlarmCounts]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Conectando a Niagara via Cloudflare Tunnel...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="error-screen">
        <div className="error-icon">!</div>
        <p>{error}</p>
        <button className="retry-btn" onClick={function () { window.location.reload(); }}>
          Reintentar
        </button>
      </div>
    );
  }

  const totalAlarms = alarmCounts
    ? (alarmCounts.unacknowledged || 0) + (alarmCounts.acknowledged || 0)
    : 0;

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <h1>{config.title || 'Dashboard BMS'} <span>Live</span></h1>
        <div className="header-status">
          <span className={'status-dot ' + (connected ? 'connected' : '')}></span>
          <span>{connected ? 'Conectado' : 'Desconectado'}</span>
          {lastUpdate && (
            <span>| {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {/* Alarm Banner */}
      {totalAlarms > 0 && (
        <div className="alarm-banner">
          <span className="icon">&#9888;</span>
          {totalAlarms} alarma{totalAlarms !== 1 ? 's' : ''} activa{totalAlarms !== 1 ? 's' : ''}
          {alarmCounts.unacknowledged > 0 && (
            <span> ({alarmCounts.unacknowledged} sin reconocer)</span>
          )}
        </div>
      )}

      {/* Floor Tabs */}
      {config.floors && (
        <div className="floor-tabs">
          {config.floors.map(function (floor) {
            return (
              <button
                key={floor.key}
                className={'floor-tab ' + (activeFloor === floor.key ? 'active' : '')}
                onClick={function () { setActiveFloor(floor.key); }}
              >
                {floor.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats Row */}
      {monitor && (
        <div className="stats-row">
          <StatCard value={monitor.total || 0} label="Total Equipos" colorClass="accent" />
          <StatCard value={monitor.online || 0} label="Online" colorClass="success" />
          <StatCard value={monitor.fanOn || 0} label="Enfriando" colorClass="info" />
          <StatCard value={monitor.standby || 0} label="Standby" colorClass="warning" />
          <StatCard value={monitor.alarms || 0} label="Alarmas" colorClass="danger" />
        </div>
      )}

      {/* Equipment Grid */}
      <div className="equipment-grid">
        {equipment.map(function (equip, index) {
          return <EquipmentCard key={equip.name || index} equip={equip} />;
        })}
        {equipment.length === 0 && monitor && (
          <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            No hay equipos configurados en este piso
          </p>
        )}
      </div>
    </div>
  );
}
