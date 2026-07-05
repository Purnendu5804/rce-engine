-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stdin" TEXT NOT NULL,
    "stdout" TEXT NOT NULL,
    "stderr" TEXT NOT NULL,
    "exitCode" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);
