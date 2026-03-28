export type TeamGraphNode = {
  id: string;
  kind: 'member' | 'pending';
  name: string;
  departmentName?: string;
  hasDepartment?: boolean;
  subtitle: string;
  employeeNumber?: string;
  avatarName: string;
  children: TeamGraphNode[];
};
