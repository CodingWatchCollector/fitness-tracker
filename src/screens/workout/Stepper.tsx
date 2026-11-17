import { strings } from '../../strings';
import { Button } from '../../ui/Button';

interface StepperProps {
  outputLabel: string;
  display: string;
  lessLabel: string;
  moreLabel: string;
  lessDisabled: boolean;
  moreDisabled: boolean;
  onLess(): void;
  onMore(): void;
}

export function Stepper(props: StepperProps) {
  return (
    <div className="stepper">
      <Button
        type="button"
        className="button stepper-button"
        aria-label={props.lessLabel}
        disabled={props.lessDisabled}
        onClick={props.onLess}
      >
        {strings.stepper.decrease}
      </Button>
      <output className="stepper-value" aria-label={props.outputLabel}>
        {props.display}
      </output>
      <Button
        type="button"
        className="button stepper-button"
        aria-label={props.moreLabel}
        disabled={props.moreDisabled}
        onClick={props.onMore}
      >
        {strings.stepper.increase}
      </Button>
    </div>
  );
}
