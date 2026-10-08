import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Quiz } from '../models/Quiz.js';

async function seed() {
  console.log('🌱 Starting database seed...');
  await connectDB();

  // Clean existing demo data if any
  const email = 'teacher@reviselive.io';
  await User.deleteOne({ email });
  console.log('Cleaned existing demo teacher if present.');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const teacher = await User.create({
    name: 'Demo Teacher',
    email,
    passwordHash
  });
  console.log(`✅ Created demo teacher: ${teacher.email} / password123`);

  // Delete previous sample quiz created by this user
  await Quiz.deleteMany({ createdBy: teacher._id });

  const sampleQuiz = await Quiz.create({
    title: 'Cell Biology & Energy Transfer',
    topic: 'Biology',
    description: 'Diagnostic revision on cellular respiration, photosynthesis, and ATP generation.',
    sourceMaterial: 'Cellular respiration occurs in mitochondria and produces ATP. Glycolysis happens in the cytoplasm. Photosynthesis occurs in chloroplasts.',
    difficulty: 'medium',
    createdBy: teacher._id,
    questions: [
      {
        questionText: 'Where in eukaryotic cells does the citric acid (Krebs) cycle take place?',
        options: [
          'Mitochondrial matrix',
          'Outer mitochondrial membrane',
          'Cytoplasm cytosol',
          'Inner thylakoid space'
        ],
        correctIndex: 0,
        explanation:
          'The citric acid cycle takes place in the mitochondrial matrix where appropriate enzymes are concentrated. Students often confuse this with glycolysis which occurs in the cytoplasm.',
        topicTag: 'Cellular Respiration',
        timeLimit: 20
      },
      {
        questionText: 'What is the primary role of chlorophyll pigments during photosynthesis?',
        options: [
          'Directly synthesize ATP molecules',
          'Absorb light photons to excite electrons',
          'Fix carbon dioxide into glucose',
          'Hydrolyze water molecules directly'
        ],
        correctIndex: 1,
        explanation:
          'Chlorophyll pigments absorb specific wavelengths of photon energy to excite reaction center electrons. A common misconception is confusing electron excitation with the enzymatic fixation of carbon in the Calvin cycle.',
        topicTag: 'Photosynthesis',
        timeLimit: 20
      },
      {
        questionText: 'During aerobic cellular respiration, what acts as the final electron acceptor?',
        options: [
          'Molecular Oxygen (O2)',
          'Carbon Dioxide (CO2)',
          'NAD+ coenzyme',
          'Pyruvate dehydrogenase'
        ],
        correctIndex: 0,
        explanation:
          'Molecular oxygen is electronegative and accepts electrons to form metabolic water. Many students incorrectly select CO2 because it is exhaled as a waste product of respiration.',
        topicTag: 'Electron Transport',
        timeLimit: 20
      },
      {
        questionText: 'Which metabolic pathway produces the net gain of 2 ATP per glucose under anaerobic conditions?',
        options: [
          'Glycolysis',
          'Oxidative phosphorylation',
          'Calvin-Benson cycle',
          'Lactic acid transport'
        ],
        correctIndex: 0,
        explanation:
          'Glycolysis splits glucose into pyruvate and nets 2 ATP without needing oxygen. Students frequently misidentify fermentation itself as the ATP-producing step rather than a NAD+ regeneration pathway.',
        topicTag: 'Anaerobic Metabolism',
        timeLimit: 20
      }
    ]
  });

  console.log(`✅ Created sample quiz: "${sampleQuiz.title}" (ID: ${sampleQuiz._id}) with ${sampleQuiz.questions.length} questions`);
  await disconnectDB();
  console.log('🌿 Seeding finished successfully.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
