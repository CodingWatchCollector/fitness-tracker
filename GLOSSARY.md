# Fitness Tracker

A workout logger used on a phone during training: it guides the session, times rests and records every set so progress can be reviewed later.

## Catalog

**Exercise**:
A catalog entry describing one movement: images, targeted muscles, description, optional video link. Either rep-based or time-based.
_Avoid_: Movement, drill

**Rep-based exercise**:
An Exercise whose Sets are measured in repetitions (dips, pull-ups).

**Time-based exercise**:
An Exercise whose Sets are measured in seconds held (plank, L-sit).
_Avoid_: Hold exercise, isometric

**Apparatus**:
What an Exercise is performed on (bar, rings, dip station, floor). Not a source of Load.
_Avoid_: Equipment, station

**Equipment item**:
A named piece of gear the user owns that serves as Load, with a nominal weight in kg ("Red band ≈ 15 kg").
_Avoid_: Gear, accessory

## Session

**Workout**:
One training session, from starting it to finishing it.
_Avoid_: Training, session

**Phase**:
A part of a Workout that groups Exercise blocks by purpose (warm-up, main; later skill, strength, cool-down).
_Avoid_: Section, stage

**Warm-up**:
The opening Phase of a Workout, before the first main Exercise block.

**Exercise block**:
One Exercise performed inside a Workout, made of one or more Sets.
_Avoid_: Exercise (when meaning the performed instance), entry

**Follow-on block**:
An Exercise block started straight after another and linked to it, so both are read as one group ("Dips → Pushups").
_Avoid_: Superset (which means alternating exercises), finisher, drop set

**Transition**:
The time between ending one Exercise block and starting the first Set of the next.
_Avoid_: Rest (which is only between Sets)

**Set**:
One effort inside an Exercise block, ending in a logged result.
_Avoid_: Round, attempt

**Reps**:
The number of clean, full repetitions in a Set, excluding Extras.
_Avoid_: Count, total

**Extra**:
Additional work in a Set beyond its Reps, with a kind and an amount (2 negatives, 5 s hold).
_Avoid_: Bonus reps, add-on

**Lead-in**:
The countdown between starting a Set and its timer actually running, to get into position. Applies to both rep-based and time-based Sets.
_Avoid_: Delay, prep time

**Time under load**:
How long a Set's effort actually lasted, from the end of its Lead-in to the end of the Set.
_Avoid_: Duration, set time, TUT

**Target time**:
The planned duration of a time-based Set, signalled when reached.
_Avoid_: Goal, limit

**RIR**:
Reps in reserve: the lifter's estimate of how many more Reps they could have done (0, 1, 2, 3+).
_Avoid_: RPE, effort score

**Rest**:
The timed pause between two Sets. Planned rest is the countdown length; actual rest is what was taken.
_Avoid_: Break, pause

**Load**:
Weight that changes the difficulty of a Set, given in kg or as an Equipment item, with a direction: harder (weighted dips) or easier (band-assisted pull-ups). Each Exercise sets the default direction.
_Avoid_: Weight, resistance

**Tag**:
A reusable short label attached to a Set to qualify it without a number ("not clean").
_Avoid_: Label, flag

**Note**:
Free text attached to a Set or to a Workout.
_Avoid_: Comment, memo

**Recap**:
The summary shown when a Workout is finished, compared against the previous Workouts.
_Avoid_: Report, summary
