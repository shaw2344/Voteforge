export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function timeLeft(endsAtIso) {
  const diff = new Date(endsAtIso).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function statusLabel(status) {
  return {
    draft: 'Draft',
    upcoming: 'Upcoming',
    active: 'Live',
    closed: 'Closed',
  }[status] || status;
}

export const STATUS_BADGE = {
  draft: 'badge-draft',
  upcoming: 'badge-upcoming',
  active: 'badge-active',
  closed: 'badge-closed',
};
