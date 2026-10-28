// Usage: npm run hash-password -- 'the password'   -> prints the hash to put in OWNERS (name:hash)
import { hashPassword } from '../src/auth.js';
if (!process.argv[2]) { console.error('Usage: npm run hash-password -- <password>'); process.exit(1); }
console.log(hashPassword(process.argv[2]));
