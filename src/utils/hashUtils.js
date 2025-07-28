import crypto from 'crypto';

export const createHash = (data) => {
  const hash = crypto.createHash('sha256').update(data).digest('hex'); // Use SHA-256 for deterministic hashing
  return hash;
};

export const compareHash = (data, hash) => {
  const generatedHash = createHash(data);
  return generatedHash === hash; // Compare the generated hash with the provided hash
};
