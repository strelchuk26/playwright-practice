const playwright = require("playwright");
const notify = require("./utils/webhook");
const config = require("./config");

let lastExams = [];

async function fetchExams() {
    const browser = await playwright.firefox.launch({ headless: true, slowMo: 50 });
    const page = await browser.newPage();

    await page.goto("https://info-car.pl/oauth2/login", { waitUntil: "networkidle" });
    await page.fill(".login-input", config.account.login);
    await page.fill(".password-input", config.account.password);

    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click("#register-button")]);

    console.log("Login successfull!");

    await page.goto("https://info-car.pl/new/prawo-jazdy/sprawdz-wolny-termin", { waitUntil: "networkidle" });

    console.log("Checking free exams...");

    await page.reload({ waitUntil: "networkidle" });

    await page.locator('input[type="radio"]').first().check();

    await page.waitForSelector("h2:has-text('Wybierz ośrodek egzaminacyjny')");

    await page.locator("#province").click();
    await page.locator("#province").fill("lubuskie");
    await page.waitForSelector("#lubuskie");
    await page.locator("#lubuskie").click();

    await page.locator("#organization").click();
    await page.locator("li.results__element", { hasText: "WORD Zielona Góra" }).click();

    await page.locator("#category-select").click();
    await page.locator("#category-select").fill("B");
    await page.waitForSelector("#b");
    await page.locator("#b").click();

    await page.locator('button:has-text("Dalej")').click();

    await page.waitForSelector("text=Praktyka");
    await page.locator('input[type="radio"][aria-label="PRACTICE"]').click();

    const dayContainers = page.locator("div.accordion-item");
    const dayCount = await dayContainers.count();

    const groupedExams = [];

    for (let i = 0; i < dayCount; i++) {
        const dayContainer = dayContainers.nth(i);
        const date = (await dayContainer.locator("h5").textContent())?.trim();

        const rows = dayContainer.locator(".theory-row");
        const rowCount = await rows.count();

        const dayExams = [];

        for (let j = 0; j < rowCount; j++) {
            const row = rows.nth(j);

            const time = (await row.locator(".exam-time").textContent())?.trim();
            const placesText = (await row.locator(".exam-places").textContent())?.trim();
            const infoText = (await row.locator(".additional-info").textContent())?.trim();

            const info = infoText?.replace("Informacje dodatkowe", "").trim();

            if (info?.includes("ŻAGAŃ") || info?.includes("TOMASZOWO")) {
                continue;
            }

            dayExams.push({
                time: time,
                places: parseInt(placesText, 10),
                info: info,
            });
        }

        if (dayExams.length > 0) {
            groupedExams.push({
                day: date,
                exams: dayExams,
            });
        }
    }

    browser.close();

    return groupedExams;
}

function getExamsWithinSomeDays(exams) {
    const now = new Date();
    const inSomeDays = new Date(now);
    inSomeDays.setDate(now.getDate() + config.maxExamTime);

    const result = [];

    for (const dayObj of exams) {
        const [dayName, dateStr] = dayObj.day.split(" ");
        const [day, month] = dateStr.split(".").map((n) => parseInt(n));
        const examDate = new Date(now.getFullYear(), month - 1, day);

        if (examDate >= now && examDate <= inSomeDays) {
            result.push({
                day: dayObj.day,
                exams: dayObj.exams,
            });
        }
    }

    return result;
}

function isNewExam(current, previous) {
    const prevFlat = previous.flatMap((d) => d.exams.map((e) => `${d.day}_${e.time}_${e.places}_${e.info}`));
    const currFlat = current.flatMap((d) => d.exams.map((e) => `${d.day}_${e.time}_${e.places}_${e.info}`));

    return currFlat.filter((e) => !prevFlat.includes(e));
}

async function checkForNewExams() {
    try {
        const exams = await fetchExams();
        const upcoming = getExamsWithinSomeDays(exams);

        const newExams = isNewExam(upcoming, lastExams);

        if (newExams.length > 0) {
            const msg = `📝 Нові екзамени:\n${newExams.join("\n")}`;
            await notify[config.notifyVia](msg);
            console.log(msg);
        } else {
            console.log("No new exams found.", new Date().toLocaleString());
        }

        lastExams = upcoming;
    } catch (err) {
        console.error("❌Error while checking new exams:", err);
    }
}

setInterval(checkForNewExams, config.refreshTime * 1000);
checkForNewExams();