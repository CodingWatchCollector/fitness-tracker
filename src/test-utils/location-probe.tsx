import { useLocation } from 'react-router-dom';

export function LocationProbe() {
  return <output aria-label="location">{useLocation().pathname}</output>;
}
