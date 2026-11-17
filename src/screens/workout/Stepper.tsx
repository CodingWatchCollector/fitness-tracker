import { strings } from '../../strings';

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
      <button
        type="button"
        className="button stepper-button"
        aria-label={props.lessLabel}
        disabled={props.lessDisabled}
        onClick={props.onLess}
      >
        {strings.stepper.decrease}
      </button>
      <output className="stepper-value" aria-label={props.outputLabel}>
        {props.display}
      </output>
      <button
        type="button"
        className="button stepper-button"
        aria-label={props.moreLabel}
        disabled={props.moreDisabled}
        onClick={props.onMore}
      >
        {strings.stepper.increase}
      </button>
    </div>
  );
}
