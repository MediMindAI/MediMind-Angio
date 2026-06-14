// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Box, Group, Loader, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import styles from './EMRStepper.module.css';

/**
 * Props for a single <EMRStepper.Step>. Mirrors the subset of Mantine's
 * Stepper.Step API the EMR consumers actually use, so converting a raw
 * Mantine Stepper is mechanical.
 */
export interface EMRStepperStepProps {
  /** Step label (rendered under/next to the indicator) */
  label?: ReactNode;
  /** Optional short description below the label */
  description?: ReactNode;
  /** Custom icon for the indicator (element, as Mantine consumers pass it) */
  icon?: ReactNode;
  /** When true, the active indicator shows a spinner instead of the icon */
  loading?: boolean;
  /** Per-step semantic color of the active/completed indicator */
  color?: 'primary' | 'success' | 'error';
  /** Click handler for this individual step (in addition to onStepClick) */
  onClick?: () => void;
  /** The step's content panel — rendered below the indicators when active */
  children?: ReactNode;
}

/**
 * <EMRStepper.Step> — declarative step descriptor. Renders nothing on its own;
 * EMRStepper reads its props to draw the indicator and its children as the
 * active content panel.
 */
export function EMRStepperStep(_props: EMRStepperStepProps): null {
  return null;
}
EMRStepperStep.displayName = 'EMRStepper.Step';

export interface EMRStepperCompletedProps {
  /** Content shown once active === number of steps */
  children?: ReactNode;
}

/**
 * <EMRStepper.Completed> — content panel rendered when active passes the last
 * step (active === step count).
 */
export function EMRStepperCompleted(_props: EMRStepperCompletedProps): null {
  return null;
}
EMRStepperCompleted.displayName = 'EMRStepper.Completed';

export interface EMRStepperProps {
  /** Zero-based index of the active step (active === count → Completed panel) */
  active: number;
  /** Click a step indicator → receives its zero-based index */
  onStepClick?: (index: number) => void;
  /** When false, indicators after the active step are not selectable */
  allowNextStepsSelect?: boolean;
  /** Indicator size */
  size?: 'sm' | 'md';
  /** <EMRStepper.Step> / <EMRStepper.Completed> children */
  children: ReactNode;
  /** Additional class on the root */
  className?: string;
  /** Test ID */
  'data-testid'?: string;
}

type StepState = 'completed' | 'active' | 'pending';

function isStepElement(child: ReactNode): child is ReactElement<EMRStepperStepProps> {
  return isValidElement(child) && child.type === EMRStepperStep;
}

function isCompletedElement(child: ReactNode): child is ReactElement<EMRStepperCompletedProps> {
  return isValidElement(child) && child.type === EMRStepperCompleted;
}

/**
 * EMRStepper — Command-styled compound stepper with content panels.
 *
 * Unlike EMRProgressStepper / EMRWizardStepper (indicator-only), this mirrors
 * Mantine's `<Stepper>` / `<Stepper.Step>` / `<Stepper.Completed>` so that
 * existing consumers (DischargeStepperSection, Form100Modal, CultureStatusStepper)
 * convert mechanically. The active step's children render as the content panel
 * below the indicator row.
 *
 * @example
 * ```tsx
 * <EMRStepper active={step} onStepClick={setStep} allowNextStepsSelect={false}>
 *   <EMRStepper.Step label="Date" icon={<IconCalendar size={18} />}>
 *     <DateForm />
 *   </EMRStepper.Step>
 *   <EMRStepper.Step label="Review">
 *     <ReviewPanel />
 *   </EMRStepper.Step>
 *   <EMRStepper.Completed>All done.</EMRStepper.Completed>
 * </EMRStepper>
 * ```
 */
export function EMRStepper({
  active,
  onStepClick,
  allowNextStepsSelect = true,
  size = 'md',
  children,
  className,
  'data-testid': testId,
}: EMRStepperProps): React.ReactElement {
  const childArray = Children.toArray(children);
  const steps = childArray.filter(isStepElement);
  const completed = childArray.find(isCompletedElement);

  const showCompletedPanel = completed !== undefined && active >= steps.length;
  const activeStep = steps[active];

  const getState = (index: number): StepState => {
    if (index < active) {
      return 'completed';
    }
    if (index === active) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <Box
      className={[styles.container, size === 'sm' ? styles.sizeSm : '', className].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      {/* Indicator row */}
      <Group className={styles.indicators} wrap="nowrap" gap={0} role="tablist">
        {steps.map((step, index) => {
          const state = getState(index);
          const isLast = index === steps.length - 1;
          const stepColor = step.props.color ?? 'primary';
          const isFutureStep = index > active;
          const selectable = Boolean(onStepClick) && (allowNextStepsSelect || !isFutureStep);

          const handleClick = (): void => {
            if (step.props.onClick) {
              step.props.onClick();
            }
            if (selectable && onStepClick) {
              onStepClick(index);
            }
          };

          return (
            <Box key={index} className={styles.stepWrapper}>
              <Stack
                className={[styles.step, selectable ? styles.selectable : ''].filter(Boolean).join(' ')}
                gap={6}
                align="center"
                role="tab"
                aria-selected={state === 'active'}
                aria-label={typeof step.props.label === 'string' ? step.props.label : `Step ${index + 1}`}
                tabIndex={selectable ? 0 : -1}
                onClick={selectable || step.props.onClick ? handleClick : undefined}
                onKeyDown={
                  selectable || step.props.onClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleClick();
                        }
                      }
                    : undefined
                }
              >
                <Box
                  className={[styles.indicator, styles[state], styles[`color_${stepColor}`]].join(' ')}
                  data-state={state}
                >
                  {state === 'completed' ? (
                    <IconCheck size={size === 'sm' ? 14 : 18} />
                  ) : state === 'active' && step.props.loading ? (
                    <Loader size={size === 'sm' ? 14 : 18} color="white" />
                  ) : step.props.icon ? (
                    step.props.icon
                  ) : (
                    <Text className={styles.indicatorNumber}>{index + 1}</Text>
                  )}
                </Box>

                {step.props.label !== undefined && (
                  <Text className={styles.label} ta="center">
                    {step.props.label}
                  </Text>
                )}
                {step.props.description !== undefined && (
                  <Text className={styles.description} ta="center">
                    {step.props.description}
                  </Text>
                )}
              </Stack>

              {!isLast && (
                <Box
                  className={[
                    styles.connector,
                    index < active ? styles.connectorCompleted : styles.connectorPending,
                  ].join(' ')}
                />
              )}
            </Box>
          );
        })}
      </Group>

      {/* Content panel for the active step (or the Completed panel) */}
      {showCompletedPanel ? (
        <Box className={styles.panel} data-testid={testId ? `${testId}-completed` : undefined}>
          {completed?.props.children}
        </Box>
      ) : activeStep?.props.children !== undefined ? (
        <Box className={styles.panel}>{activeStep.props.children}</Box>
      ) : null}
    </Box>
  );
}

EMRStepper.Step = EMRStepperStep;
EMRStepper.Completed = EMRStepperCompleted;

export default EMRStepper;
