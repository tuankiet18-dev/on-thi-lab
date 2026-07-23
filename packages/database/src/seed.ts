import {
  createDatabaseConnection,
  courses,
  curricula,
  curriculumCourses,
  majors,
} from "./index";
import {
  initialCampuses,
  initialCurriculum,
  initialMajor,
  priorityCourses,
} from "./catalog-data";
import { campuses } from "./schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  const { db, close } = createDatabaseConnection(connectionString);

  try {
    await db.transaction(async (transaction) => {
      for (const campus of initialCampuses) {
        await transaction
          .insert(campuses)
          .values(campus)
          .onConflictDoUpdate({
            target: campuses.code,
            set: { name: campus.name, isActive: true, updatedAt: new Date() },
          });
      }

      const [major] = await transaction
        .insert(majors)
        .values(initialMajor)
        .onConflictDoUpdate({
          target: majors.code,
          set: { name: initialMajor.name, updatedAt: new Date() },
        })
        .returning({ id: majors.id });

      if (!major) throw new Error("Failed to seed the initial major");

      const [curriculum] = await transaction
        .insert(curricula)
        .values({
          ...initialCurriculum,
          majorId: major.id,
        })
        .onConflictDoUpdate({
          target: [curricula.majorId, curricula.code],
          set: {
            name: initialCurriculum.name,
            effectiveFrom: initialCurriculum.effectiveFrom,
            updatedAt: new Date(),
          },
        })
        .returning({ id: curricula.id });

      if (!curriculum) throw new Error("Failed to seed the initial curriculum");

      for (const course of priorityCourses) {
        const [savedCourse] = await transaction
          .insert(courses)
          .values({
            code: course.code,
            name: course.name,
            description: `Priority launch curriculum · Term ${course.termNumber} · Wave ${course.priorityWave}`,
            priorityWave: course.priorityWave,
            examFormatStatus: course.examFormatStatus,
          })
          .onConflictDoUpdate({
            target: courses.code,
            set: {
              name: course.name,
              description: `Priority launch curriculum · Term ${course.termNumber} · Wave ${course.priorityWave}`,
              priorityWave: course.priorityWave,
              examFormatStatus: course.examFormatStatus,
              updatedAt: new Date(),
            },
          })
          .returning({ id: courses.id });

        if (!savedCourse) {
          throw new Error(`Failed to seed course ${course.code}`);
        }

        await transaction
          .insert(curriculumCourses)
          .values({
            curriculumId: curriculum.id,
            courseId: savedCourse.id,
            termNumber: course.termNumber,
            isElective: false,
          })
          .onConflictDoUpdate({
            target: [
              curriculumCourses.curriculumId,
              curriculumCourses.courseId,
            ],
            set: {
              termNumber: course.termNumber,
              isElective: false,
            },
          });
      }
    });

    console.log(
      `Seeded ${initialCampuses.length} campuses and ${priorityCourses.length} priority courses.`,
    );
  } finally {
    await close();
  }
}

await seed();
