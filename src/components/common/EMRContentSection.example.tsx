// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Stack, TextInput, Button, Group } from '@mantine/core';
import { IconUser, IconMail, IconPhone, IconSettings } from '@tabler/icons-react';
import { EMRContentSection } from './EMRContentSection';

/**
 * Example usage of EMRContentSection component
 *
 * This file demonstrates various use cases and configurations
 */

// Example 1: Basic section with title and icon
export function BasicSectionExample() {
  return (
    <EMRContentSection title="Patient Information" icon={IconUser}>
      <Stack gap="md">
        <TextInput label="Full Name" placeholder="Enter patient name" />
        <TextInput label="Date of Birth" type="date" />
        <TextInput label="Medical Record Number" placeholder="MRN" />
      </Stack>
    </EMRContentSection>
  );
}

// Example 2: Collapsible section
export function CollapsibleSectionExample() {
  return (
    <EMRContentSection
      title="Contact Information"
      icon={IconMail}
      collapsible
      defaultExpanded={true}
      showAccent
    >
      <Stack gap="md">
        <TextInput label="Email" placeholder="patient@example.com" />
        <TextInput label="Phone" placeholder="+995 XXX XXX XXX" />
        <TextInput label="Address" placeholder="Street address" />
      </Stack>
    </EMRContentSection>
  );
}

// Example 3: Section with header actions
export function SectionWithActionsExample() {
  return (
    <EMRContentSection
      title="Emergency Contacts"
      icon={IconPhone}
      headerActions={
        <Group gap="xs">
          <Button size="xs" variant="light">
            Add Contact
          </Button>
          <Button size="xs" variant="subtle">
            Edit
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <TextInput label="Contact Name" />
        <TextInput label="Relationship" />
        <TextInput label="Phone Number" />
      </Stack>
    </EMRContentSection>
  );
}

// Example 4: Loading state
export function LoadingSectionExample() {
  return (
    <EMRContentSection title="Loading Data" icon={IconSettings} loading={true}>
      <div>This content won&apos;t be shown while loading</div>
    </EMRContentSection>
  );
}

// Example 5: Empty state
export function EmptySectionExample() {
  return (
    <EMRContentSection
      title="No Data Available"
      icon={IconUser}
      emptyStateMessage="No patient records found. Click 'Add Patient' to get started."
    />
  );
}

// Example 6: Section with accent border
export function AccentSectionExample() {
  return (
    <EMRContentSection title="Important Information" icon={IconSettings} showAccent={true}>
      <Stack gap="md">
        <TextInput label="Critical Alert" />
        <TextInput label="Special Instructions" />
      </Stack>
    </EMRContentSection>
  );
}

// Example 7: Collapsed by default
export function CollapsedByDefaultExample() {
  return (
    <EMRContentSection
      title="Advanced Settings"
      icon={IconSettings}
      collapsible
      defaultExpanded={false}
    >
      <Stack gap="md">
        <TextInput label="API Key" type="password" />
        <TextInput label="Webhook URL" />
      </Stack>
    </EMRContentSection>
  );
}

// Example 8: Minimal section (no header)
export function MinimalSectionExample() {
  return (
    <EMRContentSection>
      <Stack gap="md">
        <TextInput label="Field 1" />
        <TextInput label="Field 2" />
      </Stack>
    </EMRContentSection>
  );
}

// Example 9: Custom padding
export function CustomPaddingExample() {
  return (
    <EMRContentSection title="Compact Section" icon={IconUser} padding="sm">
      <TextInput label="Compact field" />
    </EMRContentSection>
  );
}

// Example 10: Full-featured section
export function FullFeaturedExample() {
  return (
    <EMRContentSection
      title="Patient Details"
      icon={IconUser}
      headerActions={
        <Group gap="xs">
          <Button size="xs" variant="light">
            Save
          </Button>
          <Button size="xs" variant="subtle">
            Cancel
          </Button>
        </Group>
      }
      collapsible
      defaultExpanded={true}
      showAccent={true}
      padding="lg"
    >
      <Stack gap="md">
        <TextInput label="First Name" placeholder="Enter first name" />
        <TextInput label="Last Name" placeholder="Enter last name" />
        <TextInput label="Email" placeholder="patient@example.com" />
        <TextInput label="Phone" placeholder="+995 XXX XXX XXX" />
      </Stack>
    </EMRContentSection>
  );
}
