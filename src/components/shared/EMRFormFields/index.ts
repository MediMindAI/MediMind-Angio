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
export { EMRNumberInput } from './EMRNumberInput';
export { EMRTextarea } from './EMRTextarea';

// Date picker
export { EMRDateInput, EMRDatePicker } from './EMRDateInput';

// Toggle components
export { EMRCheckbox } from './EMRCheckbox';
export { EMRRadioGroup } from './EMRRadioGroup';

// Default export for convenience
export { EMRTextInput as default } from './EMRTextInput';
