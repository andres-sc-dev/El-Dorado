import { useEffect, useMemo, useState } from 'react';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import { catalogNames, createTableRecord, getCatalogs, getTableRecords } from '../services/dataEntryService';

const numericFields = new Set([
  'capacity', 'country_id', 'sport_id', 'league_id', 'stadium_id', 'number', 'user_id', 'team_id',
  'position', 'jersey_number', 'nationality_id', 'points', 'matches_played', 'wins', 'draws', 'losses',
  'goals_for', 'goals_against', 'customer_id', 'status', 'matchday_id', 'home_team_id', 'away_team_id',
  'home_goals', 'away_goals', 'player_id', 'goals', 'assists', 'yellow_cards', 'red_cards', 'match_id',
  'market', 'outcome', 'account_id', 'type', 'odd_id',
]);

const tableForms = [
  { name: 'country', fields: [['name', 'Nombre'], ['code', 'Código ISO']] },
  { name: 'sport', fields: [['name', 'Nombre']] },
  { name: 'stadium', fields: [['name', 'Nombre'], ['city', 'Ciudad'], ['capacity', 'Capacidad']] },
  { name: 'company', fields: [['name', 'Nombre'], ['tax_id', 'NIT'], ['license', 'Licencia'], ['address', 'Dirección'], ['phone', 'Teléfono'], ['email', 'Correo']] },
  { name: 'game_rule', fields: [['sport_id', 'Deporte'], ['description', 'Descripción']] },
  { name: 'league', fields: [['country_id', 'País'], ['sport_id', 'Deporte'], ['name', 'Nombre'], ['season', 'Temporada']] },
  { name: 'team', fields: [['league_id', 'Liga'], ['stadium_id', 'Estadio'], ['name', 'Nombre'], ['crest_url', 'URL del escudo']] },
  { name: 'matchday', fields: [['league_id', 'Liga'], ['number', 'Número'], ['date', 'Fecha']] },
  { name: 'customer', fields: [['user_id', 'Usuario'], ['full_name', 'Nombre completo'], ['document_number', 'Documento'], ['birth_date', 'Nacimiento'], ['phone', 'Teléfono'], ['address', 'Dirección']] },
  { name: 'player', fields: [['team_id', 'Equipo'], ['name', 'Nombre'], ['position', 'Posición'], ['jersey_number', 'Dorsal'], ['nationality_id', 'Nacionalidad'], ['birth_date', 'Nacimiento']] },
  { name: 'team_stats', fields: [['team_id', 'Equipo'], ['points', 'Puntos'], ['matches_played', 'Partidos'], ['wins', 'Victorias'], ['draws', 'Empates'], ['losses', 'Derrotas'], ['goals_for', 'Goles a favor'], ['goals_against', 'Goles en contra']] },
  { name: 'account', fields: [['customer_id', 'Cliente'], ['account_number', 'Número de cuenta'], ['status', 'Estado']] },
  { name: 'match', fields: [['league_id', 'Liga'], ['matchday_id', 'Jornada'], ['home_team_id', 'Equipo local'], ['away_team_id', 'Equipo visitante'], ['stadium_id', 'Estadio'], ['match_date', 'Fecha y hora'], ['status', 'Estado'], ['home_goals', 'Goles local'], ['away_goals', 'Goles visitante']] },
  { name: 'player_stats', fields: [['player_id', 'Jugador'], ['goals', 'Goles'], ['assists', 'Asistencias'], ['yellow_cards', 'Amarillas'], ['red_cards', 'Rojas'], ['matches_played', 'Partidos']] },
  { name: 'odds', fields: [['match_id', 'Partido'], ['player_id', 'Jugador'], ['market', 'Mercado'], ['outcome', 'Resultado'], ['odd_value', 'Cuota']] },
  { name: 'balance_movement', fields: [['account_id', 'Cuenta'], ['type', 'Tipo'], ['amount', 'Monto'], ['resulting_balance', 'Saldo resultante']] },
  { name: 'bet', fields: [['customer_id', 'Cliente'], ['match_id', 'Partido'], ['odd_id', 'Cuota'], ['amount', 'Monto'], ['odd_value_at_bet', 'Cuota al apostar'], ['potential_payout', 'Pago potencial'], ['status', 'Estado']] },
];

const references = {
  country_id: ['country', 'name'],
  sport_id: ['sport', 'name'],
  league_id: ['league', 'name'],
  stadium_id: ['stadium', 'name'],
  user_id: ['users', 'username'],
  team_id: ['team', 'name'],
  home_team_id: ['team', 'name'],
  away_team_id: ['team', 'name'],
  nationality_id: ['country', 'name'],
  customer_id: ['customer', 'full_name'],
  matchday_id: ['matchday', 'number'],
  player_id: ['player', 'name'],
  match_id: ['match', 'id'],
  odd_id: ['odds', 'id'],
  account_id: ['account', 'account_number'],
  status: ['catalog', 'name'],
  position: ['player_position', 'name'],
  market: ['odds_market', 'name'],
  outcome: ['odds_outcome', 'name'],
  type: ['movement_type', 'name'],
};

function initialValues(form) {
  return Object.fromEntries(form.fields.map(([field]) => [field, '']));
}

function AdminDataPage() {
  const [selectedTable, setSelectedTable] = useState(tableForms[0].name);
  const [records, setRecords] = useState([]);
  const [catalogs, setCatalogs] = useState({});
  const [relatedRecords, setRelatedRecords] = useState({});
  const [values, setValues] = useState(initialValues(tableForms[0]));
  const [message, setMessage] = useState('');

  const form = useMemo(
    () => tableForms.find((item) => item.name === selectedTable) || tableForms[0],
    [selectedTable],
  );

  useEffect(() => {
    setValues(initialValues(form));
    setMessage('');
    Promise.all([
      getTableRecords(selectedTable),
      getCatalogs(),
      ...Object.values(references)
        .filter(([table]) => table !== 'catalog' && !catalogNames.includes(table))
        .map(([table]) => getTableRecords(table).then((data) => [table, data])),
    ])
      .then(([tableData, catalogData, ...related]) => {
        setRecords(tableData);
        setCatalogs(catalogData);
        setRelatedRecords(Object.fromEntries(related));
      })
      .catch((error) => setMessage(error.message));
  }, [selectedTable, form]);

  const optionsFor = (field) => {
    const reference = references[field];
    if (!reference) return [];
    if (field === 'status') {
      const statusCatalog = {
        users: 'user_status',
        account: 'account_status',
        match: 'match_status',
        bet: 'bet_status',
      }[selectedTable];
      return statusCatalog ? (catalogs[statusCatalog] || []) : [];
    }
    if (reference[0] === 'catalog') return catalogs[reference[0]] || [];
    if (catalogs[reference[0]]) return catalogs[reference[0]];
    return relatedRecords[reference[0]] || [];
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    const payload = {};
    for (const [field] of form.fields) {
      if (values[field] === '') continue;
      payload[field] = numericFields.has(field) ? Number(values[field]) : values[field];
    }
    try {
      await createTableRecord(selectedTable, payload);
      setMessage('Registro guardado correctamente.');
      setValues(initialValues(form));
      setRecords(await getTableRecords(selectedTable));
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="page-shell">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Administración</p>
        <h1 className="mt-2 text-3xl font-black text-white">Carga de datos</h1>
        <p className="mt-2 text-slate-300">Crea registros respetando las relaciones de la base de datos y consulta los datos guardados.</p>

        <div className="mt-8 grid gap-6 xl:grid-cols-[380px_1fr]">
          <form onSubmit={submit} className="glass-panel rounded-2xl p-5">
            <label className="text-sm text-slate-300" htmlFor="table">Tabla</label>
            <select id="table" className="form-input mt-2" value={selectedTable} onChange={(event) => setSelectedTable(event.target.value)}>
              {tableForms.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
            <div className="mt-4 space-y-3">
              {form.fields.map(([field, label]) => {
                const options = optionsFor(field);
                const isDate = field.includes('date');
                return (
                  <label key={field} className="block text-sm text-slate-300">
                    {label}
                    {options.length > 0 ? (
                      <select className="form-input mt-1" value={values[field]} onChange={(event) => setValues({ ...values, [field]: event.target.value })}>
                        <option value="">Selecciona…</option>
                        {options.map((option) => <option key={option.id} value={option.id}>{option.name || option.username || option.full_name || option.account_number || option.number || option.id}</option>)}
                      </select>
                    ) : (
                      <input
                        className="form-input mt-1"
                        type={field === 'password' ? 'password' : isDate ? (field === 'match_date' ? 'datetime-local' : 'date') : numericFields.has(field) ? 'number' : 'text'}
                        value={values[field]}
                        onChange={(event) => setValues({ ...values, [field]: event.target.value })}
                        required={['country', 'sport'].includes(selectedTable) ? field === 'name' : ['name', 'tax_id', 'username', 'email', 'password', 'description', 'full_name', 'document_number', 'birth_date', 'league_id', 'sport_id', 'country_id', 'season', 'team_id', 'stadium_id', 'number', 'user_id', 'customer_id', 'matchday_id', 'home_team_id', 'away_team_id', 'match_date', 'match_id', 'odd_id', 'amount', 'odd_value_at_bet', 'odd_value_at_bet', 'potential_payout', 'odd_value', 'resulting_balance'].includes(field)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <Button type="submit" className="mt-5 w-full">Guardar {selectedTable}</Button>
            {message && <p className="mt-3 text-sm text-brand-gold">{message}</p>}
          </form>

          <section className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-xl font-bold text-white">Registros guardados</h2>
              <p className="mt-1 text-sm text-slate-400">{records.length} registros en {selectedTable}</p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/40 text-slate-300"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Datos</th></tr></thead>
                <tbody>
                  {records.map((record) => <tr key={record.id} className="border-t border-white/5"><td className="px-5 py-3 text-brand-gold">{record.id}</td><td className="max-w-xl px-5 py-3 text-slate-300">{Object.entries(record).filter(([key]) => key !== 'id').map(([key, value]) => `${key}: ${value ?? '—'}`).join(' · ')}</td></tr>)}
                  {records.length === 0 && <tr><td colSpan="2" className="px-5 py-8 text-center text-slate-400">No hay registros todavía.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default AdminDataPage;
