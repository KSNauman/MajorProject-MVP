// Prisma filter for the assignments a student may see and launch.
// The student must still belong to the class, and personal assignments only
// apply to the student they were given to. Pass classId to limit it to one class.
const studentAssignmentWhere = (studentId, classId) => ({
    ...(classId ? { classId } : {}),
    class: { memberships: { some: { userId: studentId, role: 'STUDENT' } } },
    OR: [{ assignedToId: studentId }, { assignedToId: null }]
});

// Returns the base username, or base_2, base_3... if it is already taken.
const uniqueUsername = async (db, base) => {
    let candidate = base;
    let suffix = 2;
    while (await db.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
        candidate = `${base}_${suffix++}`;
    }
    return candidate;
};

module.exports = { studentAssignmentWhere, uniqueUsername };
