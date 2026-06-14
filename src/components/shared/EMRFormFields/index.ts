// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

// Types
export * from './EMRFieldTypes';

// CSS (must be imported once)
import './emr-fields.css';

// Core wrapper
export { EMRFieldWrapper } from './EMRFieldWrapper';

// Input components
export { EMRTextInput } from './EMRTextInput';
export { EMRSelect } from './EMRSelect';
export { EMRVirtualSelect } from './EMRVirtualSelect';
export { EMRMultiSelect } from './EMRMultiSelect';
export { EMRAutocomplete } from './EMRAutocomplete';
export type { EMRAutocompleteProps, EMRAutocompleteOption } from './EMRAutocomplete';
export { EMRNumberInput } from './EMRNumberInput';
export { EMRTextarea } from './EMRTextarea';
export { EMRColorInput } from './EMRColorInput';
export { EMRTimeInput } from './EMRTimeInput';
export { EMRSlider } from './EMRSlider';
export type { EMRSliderProps } from './EMRSlider';

// Rich text editor — deferred from the angio migration: EMRRichText needs the
// @tiptap/* packages which are not installed here. Re-add this export (and
// `npm i @tiptap/react @tiptap/starter-kit @tiptap/core @tiptap/pm ...`) during
// the UI rebuild if rich-text editing is needed.

// Date picker - use custom Apple-inspired calendar from common
export { EMRDatePicker } from '../../common/EMRDatePicker';

// Date-time picker (date + time in one field)
export { EMRDateTimePicker } from './EMRDateTimePicker';
export type { EMRDateTimePickerProps } from './EMRDateTimePicker';

// Toggle components
export { EMRCheckbox } from './EMRCheckbox';
export { EMRSwitch } from './EMRSwitch';
export { EMRRadioGroup } from './EMRRadioGroup';

// Layout components
export { EMRFormRow } from './EMRFormRow';
export { EMRFormSection } from './EMRFormSection';
export { EMRFormActions } from './EMRFormActions';

// Default exports for convenience
export { EMRTextInput as default } from './EMRTextInput';
