export type TeamGraphNode = {
  id: string;
  kind: 'member' | 'pending';
  name: string;
  subtitle: string;
  avatarName: string;
  children: TeamGraphNode[];
};
