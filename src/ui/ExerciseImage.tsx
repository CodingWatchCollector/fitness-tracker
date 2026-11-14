import { bundledImageUrl, type Exercise, type ImageRef } from '../data';
import { strings } from '../strings';
import { PatternIcon } from './PatternIcon';

interface Props {
  exercise: Exercise;
  imageRef: ImageRef | null;
  position: 'start' | 'end';
}

export function ExerciseImage({ exercise, imageRef, position }: Props) {
  if (imageRef) {
    return (
      <img
        className="detail-image"
        alt={strings.exerciseDetail.imageAlt[position](exercise.name)}
        src={bundledImageUrl(imageRef.key)}
      />
    );
  }
  return (
    <div
      className="placeholder"
      role="img"
      aria-label={strings.exerciseDetail.noPhoto(exercise.name)}
    >
      <PatternIcon pattern={exercise.pattern} />
      <span aria-hidden="true">{exercise.name}</span>
    </div>
  );
}
