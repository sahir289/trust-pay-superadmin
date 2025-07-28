export const generateUniqueCode = () => {
  const digits = '0123456789';
  let code = '';

  for (let i = 0; i < 16; i++) {
    const randomDigit = digits[Math.floor(Math.random() * digits.length)];
    code += randomDigit;

    // Add hyphen after every 4 digits except after the last group
    if ((i + 1) % 4 === 0 && i !== 15) {
      code += '-';
    }
  }

  return code;
};
