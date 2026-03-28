export type TeamGraphNode = {
  id: string;
  kind: 'member' | 'pending';
  name: string;
  subtitle: string;
  employeeNumber?: string;
  avatarName: string;
  children: TeamGraphNode[];
};
