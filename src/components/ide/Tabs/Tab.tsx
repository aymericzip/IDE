import type { ReactNode } from 'react';
import { TAB_TYPE } from '../constants';

export const Tab = (_props: {
  activeClassName?: string;
  children: ReactNode;
  closable?: boolean;
  headerClassName?: string;
  icon?: boolean;
  id?: string;
  inactiveClassName?: string;
  onClose?: () => void;
  title: string;
}): null => null;

Tab._type = TAB_TYPE;
