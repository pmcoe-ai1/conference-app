/**
 * Database seed script
 * Creates sample data for testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');
  
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@pmcoe.com' },
    update: {},
    create: {
      email: 'admin@pmcoe.com',
      passwordHash: adminPassword,
      name: 'Conference Admin'
    }
  });
  console.log(`✅ Admin created: ${admin.email} (password: admin123)`);
  
  // Create conference
  const conference = await prisma.conference.upsert({
    where: { urlCode: 'PMI-SUMMIT-2026' },
    update: {},
    create: {
      name: 'PMI Global Summit 2026',
      urlCode: 'PMI-SUMMIT-2026',
      description: 'Annual project management excellence conference bringing together industry leaders from around the world.',
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-03-18'),
      status: 'active',
      adminId: admin.id,
      qrCodeUrl: 'data:image/png;base64,placeholder'
    }
  });
  console.log(`✅ Conference created: ${conference.name}`);
  
  // Create surveys
  const survey1 = await prisma.survey.upsert({
    where: { id: 'survey-day1-feedback' },
    update: {},
    create: {
      id: 'survey-day1-feedback',
      conferenceId: conference.id,
      title: 'Day 1 Experience Survey',
      description: 'Share your feedback on today\'s sessions and help us improve.',
      status: 'active',
      sortOrder: 1
    }
  });
  
  const survey2 = await prisma.survey.upsert({
    where: { id: 'survey-demographics' },
    update: {},
    create: {
      id: 'survey-demographics',
      conferenceId: conference.id,
      title: 'Attendee Demographics',
      description: 'Help us understand our audience better.',
      status: 'inactive',
      sortOrder: 0
    }
  });
  console.log(`✅ Surveys created: ${survey1.title}, ${survey2.title}`);
  
  // Create questions for Survey 1
  const questions1 = [
    {
      id: 'q1-rating',
      surveyId: survey1.id,
      text: 'How would you rate the overall conference experience so far?',
      type: 'rating',
      options: { min: 1, max: 5, labels: { 1: 'Poor', 3: 'Average', 5: 'Excellent' } },
      isRequired: true,
      sortOrder: 0
    },
    {
      id: 'q1-sessions',
      surveyId: survey1.id,
      text: 'Which sessions did you attend today?',
      type: 'multi_choice',
      options: { 
        choices: [
          'Keynote: Future of PM',
          'Workshop: Agile at Scale',
          'Panel: AI in Projects',
          'Networking Lunch',
          'Breakout: Risk Management'
        ]
      },
      isRequired: true,
      sortOrder: 1
    },
    {
      id: 'q1-experience',
      surveyId: survey1.id,
      text: 'How many years of project management experience do you have?',
      type: 'numeric_range',
      options: { ranges: ['0-2 years', '3-5 years', '6-10 years', '11-15 years', '15+ years'] },
      isRequired: true,
      sortOrder: 2
    },
    {
      id: 'q1-suggestions',
      surveyId: survey1.id,
      text: 'What topics would you like to see covered in future sessions?',
      type: 'text_long',
      options: { maxLength: 500, placeholder: 'Share your suggestions...' },
      isRequired: false,
      sortOrder: 3
    }
  ];
  
  for (const q of questions1) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: q,
      create: q
    });
  }
  
  // Create questions for Survey 2
  const questions2 = [
    {
      id: 'q2-role',
      surveyId: survey2.id,
      text: 'What is your current role?',
      type: 'single_choice',
      options: { 
        choices: ['Project Manager', 'Program Manager', 'Portfolio Manager', 'PMO Director', 'Consultant', 'Other']
      },
      isRequired: true,
      sortOrder: 0
    },
    {
      id: 'q2-industry',
      surveyId: survey2.id,
      text: 'Which industry do you primarily work in?',
      type: 'single_choice',
      options: { 
        choices: ['Technology', 'Finance & Banking', 'Healthcare', 'Manufacturing', 'Government', 'Construction', 'Other']
      },
      isRequired: true,
      sortOrder: 1
    },
    {
      id: 'q2-certs',
      surveyId: survey2.id,
      text: 'What certifications do you hold?',
      type: 'multi_choice',
      options: { 
        choices: ['PMP', 'CAPM', 'PMI-ACP', 'PMI-PBA', 'PRINCE2', 'Scrum Master', 'None yet']
      },
      isRequired: false,
      sortOrder: 2
    }
  ];
  
  for (const q of questions2) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: q,
      create: q
    });
  }
  console.log(`✅ Questions created: ${questions1.length + questions2.length} total`);
  
  // Create sample attendees
  const attendeePassword = await bcrypt.hash('test1234', 12);
  const attendees = [
    { email: 'john.smith@company.com', status: 'active' },
    { email: 'sarah.johnson@techcorp.io', status: 'active' },
    { email: 'mike.wilson@startup.co', status: 'first_login' },
    { email: 'emma.davis@enterprise.com', status: 'active' },
    { email: 'alex.chen@consulting.biz', status: 'active' }
  ];
  
  for (const att of attendees) {
    await prisma.attendee.upsert({
      where: { 
        conferenceId_email: { 
          conferenceId: conference.id, 
          email: att.email 
        } 
      },
      update: {},
      create: {
        conferenceId: conference.id,
        email: att.email,
        passwordHash: att.status === 'active' ? attendeePassword : null,
        status: att.status,
        firstLoginAt: new Date(),
        lastLoginAt: new Date()
      }
    });
  }
  console.log(`✅ Attendees created: ${attendees.length} (password for active: test1234)`);
  
  // Create sample responses
  const activeAttendees = await prisma.attendee.findMany({
    where: { 
      conferenceId: conference.id,
      status: 'active'
    }
  });
  
  let responseCount = 0;
  for (const attendee of activeAttendees.slice(0, 3)) {
    // Rating response
    await prisma.response.upsert({
      where: {
        questionId_attendeeId: {
          questionId: 'q1-rating',
          attendeeId: attendee.id
        }
      },
      update: {},
      create: {
        questionId: 'q1-rating',
        attendeeId: attendee.id,
        answer: { value: Math.floor(Math.random() * 2) + 4 } // 4 or 5
      }
    });
    responseCount++;
    
    // Sessions response
    const sessions = [
      'Keynote: Future of PM',
      'Workshop: Agile at Scale',
      'Panel: AI in Projects',
      'Networking Lunch'
    ];
    const selected = sessions.filter(() => Math.random() > 0.3);
    
    await prisma.response.upsert({
      where: {
        questionId_attendeeId: {
          questionId: 'q1-sessions',
          attendeeId: attendee.id
        }
      },
      update: {},
      create: {
        questionId: 'q1-sessions',
        attendeeId: attendee.id,
        answer: { selected }
      }
    });
    responseCount++;
    
    // Experience response
    const ranges = ['0-2 years', '3-5 years', '6-10 years', '11-15 years', '15+ years'];
    await prisma.response.upsert({
      where: {
        questionId_attendeeId: {
          questionId: 'q1-experience',
          attendeeId: attendee.id
        }
      },
      update: {},
      create: {
        questionId: 'q1-experience',
        attendeeId: attendee.id,
        answer: { selected: ranges[Math.floor(Math.random() * ranges.length)] }
      }
    });
    responseCount++;
  }
  console.log(`✅ Sample responses created: ${responseCount}`);
  
  console.log('\n🌱 Seeding complete!\n');
  console.log('You can now:');
  console.log('  • Login as admin: admin@pmcoe.com / admin123');
  console.log('  • Login as attendee: john.smith@company.com / test1234');
  console.log(`  • Access conference: /c/${conference.urlCode}`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
