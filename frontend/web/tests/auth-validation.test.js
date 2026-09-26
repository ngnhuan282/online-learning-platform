import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAuth } from '../src/features/auth/schemas/authValidation.js';

const registration = password => ({
  fullName: 'Nguyễn Văn A',
  email: 'user@example.com',
  password,
  confirmPassword: password,
  terms: true,
});

test('registration requires uppercase, lowercase and a digit', () => {
  for (const password of ['lowercase9', 'UPPERCASE9', 'NoDigitsHere', 'Aa1']) {
    assert.ok(validateAuth(registration(password), 'register').password);
  }
});

test('registration and login respect the BCrypt UTF-8 byte limit', () => {
  for (const mode of ['register', 'login']) {
    for (const password of ['Aa1' + 'x'.repeat(69), 'Aa1' + '界'.repeat(23)]) {
      assert.deepEqual(validateAuth(registration(password), mode), {});
      assert.match(validateAuth(registration(password + 'x'), mode).password, /72 byte/);
    }
  }
});

test('login does not apply new registration strength requirements to existing accounts', () => {
  assert.deepEqual(validateAuth({ email: 'user@example.com', password: 'oldpassword' }, 'login'), {});
});

test('registration validates confirmation and consent before submitting', () => {
  const errors = validateAuth(
    { ...registration('StrongPass9'), confirmPassword: 'different', terms: false },
    'register',
  );
  assert.ok(errors.confirmPassword);
  assert.ok(errors.terms);
});
