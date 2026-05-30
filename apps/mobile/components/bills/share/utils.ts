export function buildGroupName(members: { isSelf?: boolean; name: string }[], selfLabel: (name: string) => string): string {
  const names = members.map((m) => m.isSelf ? selfLabel(m.name) : m.name);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export function contactKey(contact: { contactId: unknown }): string {
  return String(contact.contactId);
}
