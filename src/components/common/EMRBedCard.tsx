// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, Menu, Popover, Text, Group, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBed,
  IconUser,
  IconEdit,
  IconTrash,
  IconArrowsExchange,
  IconNotes,
  IconDoorExit,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import type { TranslationContextValue } from '../../contexts/TranslationContext';
import styles from './EMRBedCard.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

/** Bed status types */
export type EMRBedStatus = 'available' | 'occupied' | 'cleaning' | 'reserved' | 'out-of-service';

/** Patient info when bed is occupied */
export interface EMRBedPatient {
  name: string;
  id: string;
  /** Optional additional info */
  admissionDate?: string;
  diagnosis?: string;
  attendingPhysician?: string;
}

/** Action definition for long-press menu */
export interface EMRBedAction {
  /** Unique key for the action */
  key: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: ComponentType<IconProps>;
  /** Click handler */
  onClick: () => void;
  /** Color variant */
  color?: 'blue' | 'red' | 'green' | 'gray';
  /** Disabled state */
  disabled?: boolean;
  /** Only show for specific statuses */
  showForStatus?: EMRBedStatus[];
}

export interface EMRBedCardProps {
  /** Icon component for the bed */
  icon?: ComponentType<IconProps>;
  /** Bed name/number */
  name: string;
  /** Bed status */
  status: EMRBedStatus;
  /** Translated status label */
  statusLabel: string;
  /** Patient info (when occupied) */
  patient?: EMRBedPatient;
  /** Click handler */
  onClick?: () => void;
  /** Selected state */
  selected?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Actions for long-press menu */
  actions?: EMRBedAction[];
  /** Callback when action menu opens */
  onActionMenuOpen?: () => void;
  /** Test ID */
  'data-testid'?: string;
}

/** Status to semantic color mapping for accessibility */
const statusColorMap: Record<EMRBedStatus, { bg: string; text: string; descriptionKey: string; descriptionFallback: Record<'en' | 'ka' | 'ru', string> }> = {
  available: {
    bg: 'var(--emr-success)',
    text: 'var(--emr-text-inverse)',
    descriptionKey: 'bedBoard.statusDescription.available',
    descriptionFallback: {
      en: 'Ready for patient admission',
      ka: 'მზადაა პაციენტის მისაღებად',
      ru: 'Готова к приему пациента',
    },
  },
  occupied: {
    bg: 'var(--emr-error)',
    text: 'var(--emr-text-inverse)',
    descriptionKey: 'bedBoard.statusDescription.occupied',
    descriptionFallback: {
      en: 'Patient currently assigned',
      ka: 'პაციენტი მიმაგრებულია',
      ru: 'Пациент назначен',
    },
  },
  cleaning: {
    bg: 'var(--emr-warning)',
    text: 'var(--emr-text-inverse)',
    descriptionKey: 'bedBoard.statusDescription.cleaning',
    descriptionFallback: {
      en: 'Undergoing sanitation',
      ka: 'მიმდინარეობს დასუფთავება',
      ru: 'Выполняется уборка',
    },
  },
  reserved: {
    bg: 'var(--emr-info)',
    text: 'var(--emr-text-inverse)',
    descriptionKey: 'bedBoard.statusDescription.reserved',
    descriptionFallback: {
      en: 'Held for upcoming patient',
      ka: 'დაჯავშნილია მომავალი პაციენტისთვის',
      ru: 'Зарезервирована для пациента',
    },
  },
  'out-of-service': {
    bg: 'var(--emr-bg-page)',
    text: 'var(--emr-text-inverse)',
    descriptionKey: 'bedBoard.statusDescription.outOfService',
    descriptionFallback: {
      en: 'Not available for use',
      ka: 'გამოყენებისთვის მიუწვდომელია',
      ru: 'Недоступна для использования',
    },
  },
};

const BED_CARD_COPY = {
  en: {
    patient: 'Patient',
    diagnosis: 'Diagnosis',
    physician: 'Physician',
    admitted: 'Admitted',
    patientDetails: 'Patient details',
    status: 'Status',
    holdForActions: 'Press and hold for more actions',
  },
  ka: {
    patient: 'პაციენტი',
    diagnosis: 'დიაგნოზი',
    physician: 'ექიმი',
    admitted: 'მიღებულია',
    patientDetails: 'პაციენტის დეტალები',
    status: 'სტატუსი',
    holdForActions: 'დამატებითი მოქმედებებისთვის დააჭირეთ და გეჭიროთ',
  },
  ru: {
    patient: 'Пациент',
    diagnosis: 'Диагноз',
    physician: 'Врач',
    admitted: 'Поступил',
    patientDetails: 'Данные пациента',
    status: 'Статус',
    holdForActions: 'Нажмите и удерживайте для дополнительных действий',
  },
};

/** Long press duration in milliseconds */
const LONG_PRESS_DURATION = 500;

/** Default actions when none provided */
const getDefaultActions = (_status: EMRBedStatus, t: TranslationContextValue['t']): EMRBedAction[] => [
  {
    key: 'edit',
    label: t('hospitalLayout.bed.edit'),
    icon: IconEdit,
    onClick: () => {},
    color: 'blue',
  },
  {
    key: 'assign',
    label: t('bedBoard.actions.assignPatient'),
    icon: IconUser,
    onClick: () => {},
    color: 'green',
    showForStatus: ['available', 'reserved'],
  },
  {
    key: 'transfer',
    label: t('bedBoard.transfer.button'),
    icon: IconArrowsExchange,
    onClick: () => {},
    color: 'blue',
    showForStatus: ['occupied'],
  },
  {
    key: 'discharge',
    label: t('bedBoard.discharge.button'),
    icon: IconDoorExit,
    onClick: () => {},
    color: 'gray',
    showForStatus: ['occupied'],
  },
  {
    key: 'notes',
    label: t('common.notes'),
    icon: IconNotes,
    onClick: () => {},
    color: 'gray',
    showForStatus: ['occupied'],
  },
  {
    key: 'remove',
    label: t('hospitalLayout.bed.delete'),
    icon: IconTrash,
    onClick: () => {},
    color: 'red',
    showForStatus: ['available', 'out-of-service'],
  },
];

/**
 * EMRBedCard - Touch-friendly bed card with status indication and action menu
 *
 * Features:
 * - Clear status color coding (green=available, red=occupied, yellow=cleaning, etc.)
 * - Patient info popover on tap/hover
 * - Long-press action menu for common operations
 * - ARIA labels for screen readers
 * - Minimum 44x44px touch targets
 * - Keyboard accessible
 *
 * @example
 * // Available bed
 * <EMRBedCard
 *   name="Bed 1"
 *   status="available"
 *   statusLabel="Available"
 *   onClick={() => handleBedSelect(bed.id)}
 * />
 *
 * @example
 * // Occupied bed with patient and actions
 * <EMRBedCard
 *   name="Bed 2"
 *   status="occupied"
 *   statusLabel="Occupied"
 *   patient={{
 *     name: "John Doe",
 *     id: "12345",
 *     admissionDate: "2024-01-15",
 *     diagnosis: "Pneumonia"
 *   }}
 *   actions={[
 *     { key: 'transfer', label: 'Transfer', icon: IconArrowsExchange, onClick: handleTransfer },
 *     { key: 'discharge', label: 'Discharge', icon: IconDoorExit, onClick: handleDischarge },
 *   ]}
 * />
 */
export function EMRBedCard({
  icon: Icon = IconBed,
  name,
  status,
  statusLabel,
  patient,
  onClick,
  selected = false,
  loading = false,
  actions,
  onActionMenuOpen,
  'data-testid': dataTestId = 'emr-bed-card',
}: EMRBedCardProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const [popoverOpened, popoverHandlers] = useDisclosure(false);
  const [menuOpened, menuHandlers] = useDisclosure(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Clean up timer on unmount and ensure menu is closed on mount
  useEffect(() => {
    // Ensure menu is closed on mount (handles hot reload / stale state)
    menuHandlers.close();

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get available actions for this status
  const availableActions = actions || getDefaultActions(status, t);
  const filteredActions = availableActions.filter(
    (action) => !action.showForStatus || action.showForStatus.includes(status)
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onClick) {
          onClick();
        }
      }
      // Open menu with context menu key or Shift+F10
      if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        menuHandlers.open();
        onActionMenuOpen?.();
      }
    },
    [onClick, menuHandlers, onActionMenuOpen]
  );

  // Long press handlers for touch devices
  const handleTouchStart = useCallback(() => {
    setIsLongPressing(false);
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      menuHandlers.open();
      onActionMenuOpen?.();
      // Vibrate if supported (haptic feedback)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION);
  }, [menuHandlers, onActionMenuOpen]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // If it was a short tap and not a long press, trigger click
    if (!isLongPressing && onClick) {
      // Close menu before calling onClick to prevent it from appearing over modals
      menuHandlers.close();
      onClick();
    }
    setIsLongPressing(false);
  }, [isLongPressing, onClick, menuHandlers]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  // Map status to CSS class name
  const statusClass =
    {
      available: styles.available,
      occupied: styles.occupied,
      cleaning: styles.cleaning,
      reserved: styles.reserved,
      'out-of-service': styles.outOfService,
    }[status] || styles.available;

  // Build class names
  const cardClasses = [
    styles.bedCard,
    statusClass,
    selected ? styles.selected : '',
    loading ? styles.loading : '',
    isLongPressing ? styles.longPressing : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Build comprehensive ARIA label
  const statusInfo = statusColorMap[status];
  const copy = BED_CARD_COPY[lang];
  const statusDescription = t(statusInfo.descriptionKey, statusInfo.descriptionFallback[lang]);
  const statusAriaLabel = t('bedBoard.a11y.status', copy.status);
  const patientAriaLabel = t('bedBoard.a11y.patient', copy.patient);
  const diagnosisAriaLabel = t('bedBoard.a11y.diagnosis', copy.diagnosis);
  const physicianAriaLabel = t('bedBoard.a11y.physician', copy.physician);
  const admittedAriaLabel = t('bedBoard.a11y.admitted', copy.admitted);
  const patientDetailsAriaLabel = t('bedBoard.a11y.patientDetails', copy.patientDetails);
  const holdForActionsLabel = t('bedBoard.a11y.holdForActions', copy.holdForActions);
  const ariaLabel = [
    `${name}`,
    `${statusLabel} - ${statusDescription}`,
    patient ? `${patientAriaLabel}: ${patient.name}, ID: ${patient.id}` : '',
    patient?.diagnosis ? `${diagnosisAriaLabel}: ${patient.diagnosis}` : '',
    holdForActionsLabel,
  ]
    .filter(Boolean)
    .join('. ');

  // Patient info content for popover
  const patientInfoContent = patient && (
    <Stack gap="xs" p="xs">
      <Group gap="xs">
        <IconUser size={16} />
        <Text fw={600} size="sm">
          {patient.name}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        ID: {patient.id}
      </Text>
      {patient.admissionDate && (
        <Text size="xs" c="dimmed">
          {admittedAriaLabel}: {patient.admissionDate}
        </Text>
      )}
      {patient.diagnosis && (
        <Text size="xs" c="dimmed">
          {diagnosisAriaLabel}: {patient.diagnosis}
        </Text>
      )}
      {patient.attendingPhysician && (
        <Text size="xs" c="dimmed">
          {physicianAriaLabel}: {patient.attendingPhysician}
        </Text>
      )}
    </Stack>
  );

  const cardContent = (
    <Box
      className={cardClasses}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={(e) => {
        // For desktop, start long press on mouse down
        if (e.button === 0) {
          handleTouchStart();
        }
      }}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchCancel}
      onContextMenu={(e) => {
        // Right-click opens menu
        e.preventDefault();
        menuHandlers.open();
        onActionMenuOpen?.();
      }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      aria-busy={loading}
      aria-expanded={menuOpened || popoverOpened}
      aria-haspopup="menu"
      data-testid={dataTestId}
      data-status={status}
    >
      {/* Status indicator strip at top */}
      <Box
        className={styles.statusStrip}
        style={{ backgroundColor: statusInfo.bg }}
        aria-hidden="true"
      />

      {/* Icon */}
      <Box className={styles.iconWrapper} aria-hidden="true">
        {status === 'occupied' && patient ? <IconUser size={24} /> : <Icon size={24} />}
      </Box>

      {/* Bed Name */}
      <h4 className={styles.bedName}>{name}</h4>

      {/* Status Badge - now with clear colors */}
      <span
        className={styles.statusBadge}
        style={{
          backgroundColor: statusInfo.bg,
          color: statusInfo.text,
        }}
        role="status"
        aria-label={`${statusAriaLabel}: ${statusLabel}`}
      >
        {statusLabel}
      </span>

      {/* Patient Info Preview (when occupied) */}
      {status === 'occupied' && patient && (
        <Popover
          opened={popoverOpened}
          onChange={(opened) => (opened ? popoverHandlers.open() : popoverHandlers.close())}
          position="top"
          withArrow
          shadow="md"
          trapFocus={false}
        >
          <Popover.Target>
            <Box
              className={styles.patientInfo}
              onMouseEnter={popoverHandlers.open}
              onMouseLeave={popoverHandlers.close}
              onClick={(e) => {
                e.stopPropagation();
                popoverHandlers.toggle();
              }}
              role="button"
              tabIndex={0}
              aria-label={`${patientDetailsAriaLabel}: ${patient.name}`}
              aria-expanded={popoverOpened}
            >
              <span className={styles.patientName}>{patient.name}</span>
              <span className={styles.patientId}>ID: {patient.id}</span>
            </Box>
          </Popover.Target>
          <Popover.Dropdown>{patientInfoContent}</Popover.Dropdown>
        </Popover>
      )}

      {/* Long press indicator */}
      {isLongPressing && <Box className={styles.longPressIndicator} aria-hidden="true" />}
    </Box>
  );

  // Wrap with Menu for actions
  // We control menu opening via long-press/right-click/keyboard only
  // Don't sync Menu's internal state for opening (only for closing via click-outside)
  return (
    <Menu
      opened={menuOpened}
      onChange={(opened) => {
        // Only handle close events, not open (we control opening ourselves)
        if (!opened) {
          menuHandlers.close();
        }
      }}
      position="bottom"
      withArrow
      shadow="md"
      width={200}
    >
      <Menu.Target>{cardContent}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{name}</Menu.Label>
        {filteredActions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Menu.Item
              key={action.key}
              leftSection={<ActionIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                menuHandlers.close();
              }}
              disabled={action.disabled}
              color={action.color === 'red' ? 'red' : undefined}
            >
              {action.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

export default EMRBedCard;
