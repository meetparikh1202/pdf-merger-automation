const fs = require("fs/promises");
const { PDFDocument, rgb, degrees } = require("pdf-lib");
const { Builder, Browser, By, Key, until } = require("selenium-webdriver");
const Chrome = require("selenium-webdriver/chrome");
const cron = require("node-cron");
const path = require("path");

const userName = "John Doe"; // Note: This name will be printed on first page of PDF

/**
 * The function generates PDF files from images in specified folders and sends them to
 * WhatsApp.
 */
const generatePDF = async () => {
  try {
    /* Read the contents of the "./subjects" directory and returns a promise that resolves to an array of
    filenames in the directory. These filenames represent the folders inside the "./subjects" directory. */
    const folders = await fs.readdir("./subjects");

    for (let folder of folders) {
      if (folder !== ".DS_Store") {
        /* Creates a new PDF document that will be used to add pages and content to the PDF. */
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();

        /* The code `page.drawText()` is used to add text to a PDF page. */
        page.drawText("Subject: " + folder, { x: 140, y: 500, size: 50 });
        page.drawText(new Date().toDateString(), {
          x: 180,
          y: 460,
          size: 25,
        });
        page.drawText(`Notes By: ${userName}`, {
          x: 120,
          y: 400,
          size: 35,
        });

        /* Read the contents of a specific folder inside the "./subjects" directory. Returns a promise that resolves
        to an array of filenames in that folder. These filenames represent the files inside the
        specified folder. */
        const files = await fs.readdir("./subjects/" + folder);

        for (let file of files) {
          /* Read the contents of a specific file inside a folder. 
          The `content` variable will hold the contents of the file as a buffer. */
          const content = await fs.readFile(`./subjects/${folder}/${file}`);

          /* Add an image to a PDF page and add a text annotation to the same page. */
          const page = pdfDoc.addPage();
          const bytes = file.endsWith(".jpeg")
            ? await pdfDoc.embedJpg(content)
            : await pdfDoc.embedPng(content);

          /* It takes in the image data as `bytes` and specifies the position and dimensions of the image on the page
          using the `x`, `y`, `width`, and `height` parameters. In this case, the image is being
          positioned at the top-left corner of the page and its width and height are set to match the width and height of the page */
          page.drawImage(bytes, {
            x: 0,
            y: 0,
            width: page.getWidth(),
            height: page.getHeight(),
          });

          page.drawText(`Notes By: ${userName}`, {
            x: 150,
            y: 250,
            size: 50,
            color: rgb(0.95, 0.12, 0.23),
            rotate: degrees(45),
          });
        }

        /* Save the modified PDF document as a byte array. */
        const modifiedPdfBytes = await pdfDoc.save();

        /* Write the modified PDF document to a file. */
        await fs.writeFile("./pdf/" + folder + ".pdf", modifiedPdfBytes);
      }
    }

    /* Send the PDF file to whatsapp once PDF file is created */
    sendPDFToWhatsApp();
  } catch (err) {
    console.log({ err });
  }
};

const sendPDFToWhatsApp = async () => {
  /* Configure the options and settings for the Chrome browser when using WebDriver. */
  const options = new Chrome.Options();

  /* Add a command line argument to the Chrome browser options to specify the directory where the user
    data for the Chrome browser should be stored. It allows the WebDriver to use a specific profile for the Chrome browser session. 
    This can be useful for preserving user settings, cookies, and other data between different runs of the WebDriver. */
  options.addArguments("--user-data-dir=chrome-data");

  /* Create instance of the WebDriver for Chrome browser. */
  const driver = new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  try {
    /* Maximize the browser window to its full size. */
    driver.manage().window().maximize();

    /* `Instruct the web driver to navigate to the URL "https://web.whatsapp.com". 
        This opens the WhatsApp Web application in the browser. */
    driver.get("https://web.whatsapp.com");

    /* NOTE: You will need to scan QR code through phone for first time ONLY, 
    your chrome profile will reuse it from (--user-data-dir directory) next time onwards */

    /* Locate the search input textbox element using a CSS selector. */
    const searchEl = driver.wait(
      until.elementLocated(By.css('div[title="Search input textbox"]'))
    );

    /* Simulate a click action on the search input textbox element. 
            This action is performed to activate the search input textbox and
            make it ready for user input. */
    searchEl.click();

    /* Simulate a user action of typing the the name of the group into the 
        search input textbox on the WhatsApp Web page. */
    searchEl.sendKeys("Class - II A Students", Key.RETURN);

    /* Pause the execution of the code for 2s (Can be increased a bit if required). 
            To allow time for certain actions to complete before proceeding to the next step. */
    await driver.sleep(2000);

    /* Locate the element that represents the contact with the name specified in search box. */
    const usernameEl = driver.wait(
      until.elementLocated(By.css('div[title="Class - II A Students"]'))
    );
    usernameEl.click();
    await driver.sleep(2000);

    /* Locate the element that represents the input textbox where the user can type a message. */
    const sendMessageEl = driver.wait(
      until.elementLocated(By.css('div[title="Type a message"]'))
    );

    sendMessageEl.click();

    /* Simluate a user action of typing a text into the input textbox page 
    and pressing the Enter key to send the message. */
    await sendMessageEl.sendKeys("Todays Notes for all subjects!!", Key.RETURN);
    await driver.sleep(2000);

    /* Read the contents of the "./pdf" directory that returns a promise that resolves to an array of filenames in the directory. 
These filenames represent the PDF files in the "./pdf" directory. */
    const files = await fs.readdir("./pdf");

    /* Iterate over the `files` array, which contains the filenames of
    the PDF files in the "./pdf" directory. */
    for (let file of files) {
      /* Attach the PDF file to a WhatsApp message and send it. */
      const attachEl = driver.wait(
        until.elementLocated(By.css('div[title="Attach"]'))
      );
      attachEl.click();
      const inputElement = await driver.wait(
        until.elementLocated(By.xpath('//input[@accept="*"]'))
      );

      inputElement.sendKeys(path.join(__dirname, `pdf/${file}`));
      await driver.sleep(3000);

      const sendButton = await driver.wait(
        until.elementLocated(By.css('span[data-icon="send"]'))
      );
      sendButton.click();
      await driver.sleep(2000);
    }

    clearPDFs();
  } catch (err) {
    console.log({ err });
  }
};

/** Clear all the files inside PDF directory everyday once sent to WhatsApp */
const clearPDFs = async () => {
  const files = await fs.readdir("./pdf");
  for (let file of files) {
    fs.unlink("./pdf/" + file).catch((err) => console.log(err));
  }
};

generatePDF();

/** Runs a cron task everyday at 4PM to generate and send PDF to WhatsApp */
cron.schedule("0 16 * * *", () => {
  generatePDF();
});
