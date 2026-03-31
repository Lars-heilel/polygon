export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])[^\s]{8,}$/;

export const PasswordRegex = {
  REGEX: PASSWORD_REGEX,
  MESSAGE:
    'Password must contain uppercase, lowercase, digits, and special characters (min 8 characters)',
  MIN_LENGTH: 8,
};
