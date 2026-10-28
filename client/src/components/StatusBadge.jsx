import { STATUS_BADGE, statusLabel } from '../utils.js';

export default function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_BADGE[status] || 'badge-draft'}`}>{statusLabel(status)}</span>;
}
