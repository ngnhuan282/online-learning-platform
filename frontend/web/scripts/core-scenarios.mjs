import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Called by auth-e2e --core; browser requests use the real shared client and Gateway.
export default async function coreScenarios({ api, run, reload, waitFor, navigate, report }) {
  const email =
    process.env.SMOKE_ADMIN_EMAIL || (process.argv.includes('--demo') ? 'demo.admin@example.com' : null);
  const password = process.env.SMOKE_ADMIN_PASSWORD || (process.argv.includes('--demo') ? 'Admin123' : null);
  assert.ok(
    email && password,
    'Set SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD or seed an isolated stack and use --demo.',
  );
  const adminLogin = await api('/auth/login', { email, password });
  assert.equal(adminLogin.status, 200);
  const token = adminLogin.body.data.accessToken;
  const categories = (await api('/categories')).body.data;
  const suffix = randomUUID();
  const courses = [];
  for (const price of [0, 100000]) {
    const course = await api(
      '/admin/courses',
      {
        title: `Browser core ${price} ${suffix}`,
        description: 'Disposable browser integration fixture',
        categoryId: categories[0].id,
        price,
        level: 'BEGINNER',
        status: 'PUBLISHED',
      },
      token,
    );
    assert.equal(course.status, 200);
    courses.push(course.body.data);
  }
  const [free, paid] = courses;
  const chapter = await api(
    `/admin/courses/${free.id}/sections`,
    { title: 'Real chapter', orderIndex: 0 },
    token,
  );
  const lessonTitle = `Real lesson ${suffix}`;
  const privateText = `Authorized lesson content ${suffix}`;
  const lesson = await api(
    `/admin/sections/${chapter.body.data.id}/lessons`,
    {
      title: lessonTitle,
      lessonType: 'TEXT',
      content: privateText,
      duration: 60,
      orderIndex: 0,
      preview: false,
    },
    token,
  );
  assert.equal(lesson.status, 200);

  await navigate(`/learning/${free.id}`);
  await waitFor('document.body.textContent.includes("Bạn chưa có quyền học khóa này")');
  assert.equal(await run('document.querySelector(".lesson-stage") === null'), true);
  report.checks.push('Real Learning 403 shows enrollment reason and no demo lessons');

  await navigate(`/courses/${free.id}`);
  await waitFor(`document.body.textContent.includes(${JSON.stringify(free.title)})`);
  await run(
    'Array.from(document.querySelectorAll("button")).find(button => button.textContent.includes("Đăng ký học miễn phí")).click()',
  );
  await waitFor(
    `location.pathname === "/learning/${free.id}" && document.body.textContent.includes(${JSON.stringify(privateText)})`,
  );
  await run('document.querySelector(".lesson-stage button").click()');
  await waitFor(
    'document.querySelector(".lesson-stage button").disabled && document.body.textContent.includes("100%")',
  );
  await reload(
    `document.body.textContent.includes(${JSON.stringify(privateText)}) && document.body.textContent.includes("100%")`,
  );
  await navigate('/my-courses');
  await waitFor(`document.body.textContent.includes(${JSON.stringify(free.title)})`);
  report.checks.push(
    'Browser Course Detail -> Free Enroll -> actual private Lesson -> Complete -> reload preserves progress -> My Courses',
  );

  await navigate(`/checkout?course=${paid.id}`);
  await waitFor('document.querySelector(".checkout-submit") !== null');
  await run('document.querySelector(".checkout-submit").click()');
  await waitFor(
    'location.pathname === "/payment/mock" && document.querySelector(".mock-result-actions button") !== null',
  );
  await run('document.querySelector(".mock-result-actions button").click()');
  await waitFor(
    'location.pathname === "/payment/result" && document.querySelector(".result-actions a")?.getAttribute("href") === "/my-courses"',
  );
  await run('document.querySelector(".result-actions a").click()');
  await waitFor(`document.body.textContent.includes(${JSON.stringify(paid.title)})`);
  report.checks.push(
    'Browser MOCK checkout -> Payment SUCCESS confirmed by Backend -> active enrollment -> My Courses',
  );
  await navigate('/account');
  await waitFor('document.querySelector(".account-menu-trigger") !== null');
}
