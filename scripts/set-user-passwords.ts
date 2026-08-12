import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/core/db';
import UserModel from '../src/core/models/user';

const users = [
  { email: 'ro.lija@hotmail.com', password: 'Rolo2026.lija', firstName: 'Rolo' },
  { email: 'silvina.iddl@gmail.com', password: 'Silvina2026.cieloAzul', firstName: 'Silvina' },
  { email: 'Natalianfernandez@hotmail.com', password: 'Natalia2026.Roca', firstName: 'Natalia' },
  { email: 'lautaroescalada1@gmail.com', password: 'Lautaro2026.escalada', firstName: 'Lautaro' },
  { email: 'crafaeljara01@gmail.com', password: 'Conrado2026.jara', firstName: 'Conrado' },
];

async function main() {
  await connectDB();

  for (const u of users) {
    const user = await UserModel.findOne({ email: u.email });
    if (user) {
      const hash = await bcrypt.hash(u.password, 10);
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { passwordHash: hash } }
      );
      console.log(`✅ Updated: ${u.email}`);
    } else {
      console.log(`❌ Not found: ${u.email}`);
    }
  }

  console.log('Done!');
  process.exit(0);
}

main();
