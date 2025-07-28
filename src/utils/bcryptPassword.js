import bcrypt from 'bcrypt';

// Encrypt Password
const createHash = async (plaintext) => {
  const hash = await bcrypt.hash(plaintext, 12); // Store hash in the database
  return hash;
};

// Compare password
const verifyHash = async (plaintext, hash) => {
  const result = await bcrypt.compare(plaintext, hash);
  return result;
};

export { createHash, verifyHash };
