/*
=========================================================
PROFESSOR AUTH CHECK
=========================================================
*/

function requireProfessorPage() {
  if (!professorToken()) {
    window.location.href = '/professor-login.html';
    return false;
  }

  return true;
}


/*
=========================================================
ELECTION LINK
=========================================================
*/

function electionLink(code) {
  return (
    window.location.origin +
    '/election/' +
    code
  );
}


/*
=========================================================
LIVE RESULTS LINK
=========================================================
*/

function liveResultsLink(code) {
  return (
    window.location.origin +
    '/live-results.html?code=' +
    encodeURIComponent(code)
  );
}


/*
=========================================================
POSITION EDITOR
=========================================================
*/

function renderPositionEditor(container) {

  const block =
    document.createElement('div');

  block.className =
    'position-block';

  block.innerHTML = `
    <label>
      Position name

      <input
        name="position_name"
        required
        placeholder="Class Representative"
      >
    </label>

    <div class="candidates"></div>

    <button
      class="btn ghost"
      type="button"
      data-add-candidate
    >
      Add candidate
    </button>

    <button
      class="btn danger"
      type="button"
      data-remove-position
    >
      Remove position
    </button>
  `;

  container.appendChild(block);


  /*
  -------------------------------------------------------
  ADD FIRST CANDIDATE
  -------------------------------------------------------
  */

  addCandidateEditor(
    block.querySelector('.candidates')
  );


  /*
  -------------------------------------------------------
  ADD MORE CANDIDATES
  -------------------------------------------------------
  */

  block
    .querySelector('[data-add-candidate]')
    .addEventListener(
      'click',
      () => {

        addCandidateEditor(
          block.querySelector('.candidates')
        );

      }
    );


  /*
  -------------------------------------------------------
  REMOVE POSITION
  -------------------------------------------------------
  */

  block
    .querySelector('[data-remove-position]')
    .addEventListener(
      'click',
      () => {

        block.remove();

      }
    );
}


/*
=========================================================
CANDIDATE EDITOR
=========================================================
*/

function addCandidateEditor(container) {

  const wrap =
    document.createElement('div');

  wrap.className =
    'card';

  wrap.style.marginTop =
    '10px';

  wrap.innerHTML = `
    <label>
      Candidate name

      <input
        name="candidate_name"
        required
        placeholder="Rahul Patil"
      >
    </label>

    <div class="grid-2">

      <label>
        Branch

        <input
          name="branch"
          placeholder="Computer Science"
        >
      </label>

      <label>
        Year

        <input
          name="year"
          placeholder="Third Year"
        >
      </label>

    </div>

    <label>
      Manifesto

      <textarea
        name="manifesto"
        placeholder="Candidate manifesto"
      ></textarea>
    </label>

    <button
      class="btn ghost"
      type="button"
      data-remove-candidate
    >
      Remove candidate
    </button>
  `;


  /*
  -------------------------------------------------------
  REMOVE CANDIDATE
  -------------------------------------------------------
  */

  wrap
    .querySelector('[data-remove-candidate]')
    .addEventListener(
      'click',
      () => {

        wrap.remove();

      }
    );


  container.appendChild(wrap);
}


/*
=========================================================
COLLECT POSITIONS
=========================================================
*/

function collectPositions(root) {

  return Array.from(
    root.querySelectorAll(
      '.position-block'
    )
  ).map(
    (block) => ({

      position_name:
        block
          .querySelector(
            '[name="position_name"]'
          )
          .value
          .trim(),

      candidates:
        Array.from(
          block.querySelectorAll(
            '.candidates .card'
          )
        ).map(
          (card) => ({

            candidate_name:
              card
                .querySelector(
                  '[name="candidate_name"]'
                )
                .value
                .trim(),

            branch:
              card
                .querySelector(
                  '[name="branch"]'
                )
                .value
                .trim(),

            year:
              card
                .querySelector(
                  '[name="year"]'
                )
                .value
                .trim(),

            manifesto:
              card
                .querySelector(
                  '[name="manifesto"]'
                )
                .value
                .trim(),

          })
        ),

    })
  );
}


/*
=========================================================
PROFESSOR LOGIN
=========================================================
*/

async function initLoginPage() {

  const form =
    document.getElementById(
      'login-form'
    );

  if (!form) return;


  if (professorToken()) {

    window.location.href =
      '/professor-dashboard.html';

    return;
  }


  const alertBox =
    document.getElementById(
      'alert'
    );


  form.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      hideAlert(alertBox);


      const body =
        Object.fromEntries(
          new FormData(form).entries()
        );


      try {

        const data =
          await api(
            '/api/professor/login',
            {
              method: 'POST',
              body,
            }
          );


        setProfessorToken(
          data.token
        );


        window.location.href =
          '/professor-dashboard.html';


      } catch (error) {

        showAlert(
          alertBox,
          error.message
        );

      }

    }
  );
}


/*
=========================================================
CREATE ELECTION
=========================================================
*/

async function initCreatePage() {

  const form =
    document.getElementById(
      'create-form'
    );

  if (!form) return;


  if (!requireProfessorPage()) {
    return;
  }


  const positions =
    document.getElementById(
      'positions'
    );

  const alertBox =
    document.getElementById(
      'alert'
    );

  const created =
    document.getElementById(
      'created'
    );

  const addPositionButton =
    document.getElementById(
      'add-position'
    );


  /*
  -------------------------------------------------------
  FIRST POSITION
  -------------------------------------------------------
  */

  renderPositionEditor(
    positions
  );


  /*
  -------------------------------------------------------
  ADD MORE POSITION
  -------------------------------------------------------
  */

  if (addPositionButton) {

    addPositionButton.addEventListener(
      'click',
      () => {

        renderPositionEditor(
          positions
        );

      }
    );

  }


  /*
  -------------------------------------------------------
  CREATE ELECTION
  -------------------------------------------------------
  */

  form.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      hideAlert(alertBox);


      const raw =
        Object.fromEntries(
          new FormData(form).entries()
        );


      /*
      ---------------------------------------------------
      YEAR-WISE LIMITS
      ---------------------------------------------------
      */

      const firstYearLimit =
        Number(
          raw.first_year_limit
        );

      const secondYearLimit =
        Number(
          raw.second_year_limit
        );

      const thirdYearLimit =
        Number(
          raw.third_year_limit
        );

      const fourthYearLimit =
        Number(
          raw.fourth_year_limit
        );


      /*
      ---------------------------------------------------
      VALIDATE YEAR-WISE LIMITS
      ---------------------------------------------------
      */

      if (
        !Number.isInteger(firstYearLimit) ||
        !Number.isInteger(secondYearLimit) ||
        !Number.isInteger(thirdYearLimit) ||
        !Number.isInteger(fourthYearLimit) ||
        firstYearLimit < 0 ||
        secondYearLimit < 0 ||
        thirdYearLimit < 0 ||
        fourthYearLimit < 0
      ) {

        showAlert(
          alertBox,
          'Student count must be a whole number greater than or equal to 0.'
        );

        return;
      }


      /*
      ---------------------------------------------------
      COLLECT POSITIONS
      ---------------------------------------------------
      */

      const positionData =
        collectPositions(
          positions
        );


      if (
        positionData.length === 0
      ) {

        showAlert(
          alertBox,
          'Please add at least one position.'
        );

        return;
      }


      /*
      ---------------------------------------------------
      VALIDATE POSITIONS AND CANDIDATES
      ---------------------------------------------------
      */

      for (
        const position of positionData
      ) {

        if (
          !position.position_name
        ) {

          showAlert(
            alertBox,
            'Please enter a position name.'
          );

          return;
        }


        if (
          position.candidates.length === 0
        ) {

          showAlert(
            alertBox,
            `Please add at least one candidate for "${position.position_name}".`
          );

          return;
        }


        for (
          const candidate of position.candidates
        ) {

          if (
            !candidate.candidate_name
          ) {

            showAlert(
              alertBox,
              `Please enter candidate name for "${position.position_name}".`
            );

            return;
          }

        }

      }


      /*
      ---------------------------------------------------
      REQUEST BODY
      ---------------------------------------------------
      */

      const body = {

        election_name:
          raw.election_name,

        description:
          raw.description,

        start_time:
          raw.start_time,

        end_time:
          raw.end_time,

        expected_voters:
          raw.expected_voters
            ? Number(
                raw.expected_voters
              )
            : null,

        first_year_limit:
          firstYearLimit,

        second_year_limit:
          secondYearLimit,

        third_year_limit:
          thirdYearLimit,

        fourth_year_limit:
          fourthYearLimit,

        positions:
          positionData,

      };


      /*
      ---------------------------------------------------
      SEND REQUEST
      ---------------------------------------------------
      */

      try {

        const data =
          await api(
            '/api/elections',
            {
              method: 'POST',

              token:
                professorToken(),

              body,
            }
          );


        /*
        -------------------------------------------------
        NORMAL ELECTION LINK
        -------------------------------------------------
        */

        const link =
          electionLink(
            data.election.election_code
          );


        /*
        -------------------------------------------------
        PUBLIC LIVE COUNTING LINK
        -------------------------------------------------
        */

        const liveLink =
          liveResultsLink(
            data.election.election_code
          );


        /*
        -------------------------------------------------
        HIDE FORM
        -------------------------------------------------
        */

        form.classList.add(
          'hidden'
        );

        created.classList.remove(
          'hidden'
        );


        /*
        -------------------------------------------------
        CREATED ELECTION RESULT
        -------------------------------------------------
        */

        created.innerHTML = `

          <div class="alert success">
            Election created successfully.
          </div>


          <h2>
            ${escapeHTML(
              data.election.election_name
            )}
          </h2>


          <p>

            <span
              class="badge ${escapeHTML(
                data.election.status
              )}"
            >
              ${escapeHTML(
                data.election.status
              )}
            </span>

          </p>


          <!-- ELECTION LINK -->

          <div class="secret-box">

            <div>

              <div class="muted">
                Election link
              </div>

              <code id="new-link">
                ${escapeHTML(
                  link
                )}
              </code>

            </div>


            <button
              class="btn secondary"
              type="button"
              id="copy-link"
            >
              Copy link
            </button>

          </div>


          <!-- LIVE COUNTING LINK -->

          <div class="secret-box">

            <div>

              <div class="muted">
                Live counting link
              </div>

              <code id="new-live-link">
                ${escapeHTML(
                  liveLink
                )}
              </code>

              <div
                class="muted"
                style="margin-top:6px;"
              >
                Share this link with students or anyone
                who wants to view live vote counting.
              </div>

            </div>


            <div
              style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
              "
            >

              <button
                class="btn secondary"
                type="button"
                id="copy-live-link"
              >
                Copy live link
              </button>


              <a
                class="btn"
                href="${escapeHTML(
                  liveLink
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open live counting
              </a>

            </div>

          </div>


          <!-- ELECTION KEY -->

          <div class="secret-box">

            <div>

              <div class="muted">
                Election key
              </div>

              <code id="new-key">
                ${escapeHTML(
                  data.election.election_key
                )}
              </code>

            </div>


            <button
              class="btn secondary"
              type="button"
              id="copy-key"
            >
              Copy key
            </button>

          </div>


          <p>

            <a
              class="btn"
              href="/professor-dashboard.html"
            >
              Go to dashboard
            </a>

          </p>

        `;


        /*
        -------------------------------------------------
        COPY ELECTION LINK
        -------------------------------------------------
        */

        const copyLinkButton =
          document.getElementById(
            'copy-link'
          );


        copyLinkButton.addEventListener(
          'click',
          async () => {

            try {

              await copyText(
                link
              );


              showCopyMessage(
                copyLinkButton,
                'Election link copied!'
              );


            } catch (error) {

              alert(
                'Unable to copy the election link.'
              );

            }

          }
        );


        /*
        -------------------------------------------------
        COPY LIVE COUNTING LINK
        -------------------------------------------------
        */

        const copyLiveLinkButton =
          document.getElementById(
            'copy-live-link'
          );


        copyLiveLinkButton.addEventListener(
          'click',
          async () => {

            try {

              await copyText(
                liveLink
              );


              showCopyMessage(
                copyLiveLinkButton,
                'Live counting link copied!'
              );


            } catch (error) {

              alert(
                'Unable to copy the live counting link.'
              );

            }

          }
        );


        /*
        -------------------------------------------------
        COPY ELECTION KEY
        -------------------------------------------------
        */

        const copyKeyButton =
          document.getElementById(
            'copy-key'
          );


        copyKeyButton.addEventListener(
          'click',
          async () => {

            try {

              await copyText(
                data.election.election_key
              );


              showCopyMessage(
                copyKeyButton,
                'Election key copied!'
              );


            } catch (error) {

              alert(
                'Unable to copy the election key.'
              );

            }

          }
        );

      } catch (error) {

        showAlert(
          alertBox,
          error.message
        );

      }

    }
  );
}


/*
=========================================================
CANDIDATE TABLE
=========================================================
*/

function candidateTable(
  positions
) {

  const rows = [];


  for (
    const position of positions || []
  ) {

    for (
      const candidate of position.candidates || []
    ) {

      rows.push(`
        <tr>

          <td>
            ${escapeHTML(
              candidate.candidate_name
            )}
          </td>

          <td>
            ${escapeHTML(
              position.position_name
            )}
          </td>

          <td>
            ${Number(
              candidate.votes || 0
            )}
          </td>

        </tr>
      `);

    }

  }


  if (!rows.length) {

    return `
      <p class="muted">
        No candidates available.
      </p>
    `;

  }


  return `
    <div
      style="overflow-x:auto;"
    >

      <table>

        <thead>

          <tr>

            <th>
              Candidate
            </th>

            <th>
              Position
            </th>

            <th>
              Votes
            </th>

          </tr>

        </thead>


        <tbody>
          ${rows.join('')}
        </tbody>

      </table>

    </div>
  `;
}


/*
=========================================================
ESCAPE HTML
=========================================================
*/

function escapeHTML(
  value
) {

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    (char) => {

      const entities = {

        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',

      };

      return entities[char];

    }
  );
}


/*
=========================================================
STUDENT VOTER TABLE
=========================================================
*/

function studentVoterTable(
  students
) {

  const voterList =
    students || [];


  const rows =
    voterList
      .map(
        (student, index) => {

          const votedAt =
            student.voted_at
              ? new Date(
                  student.voted_at
                ).toLocaleString()
              : '-';


          return `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHTML(
                  student.student_name
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.roll_no
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.branch
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.year
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.email
                )}
              </td>

              <td>
                ${escapeHTML(
                  votedAt
                )}
              </td>

            </tr>
          `;

        }
      )
      .join('');


  return `
    <div
      class="card"
      style="
        margin-top:16px;
        overflow-x:auto;
      "
    >

      <div class="row-between">

        <div>

          <h3>
            Students who voted
          </h3>

          <p class="muted">
            Live list of students who have
            successfully submitted their vote.
          </p>

        </div>


        <span class="badge Active">
          ${voterList.length} voted
        </span>

      </div>


      <div
        style="margin:12px 0;"
      >

        <button
          class="btn secondary"
          type="button"
          data-download-voter-list
          ${
            voterList.length === 0
              ? 'disabled'
              : ''
          }
        >
          Download Voter List (PDF)
        </button>

      </div>


      ${
        voterList.length
          ? `
            <table>

              <thead>

                <tr>

                  <th>#</th>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Branch</th>
                  <th>Year</th>
                  <th>Email</th>
                  <th>Voted At</th>

                </tr>

              </thead>


              <tbody>
                ${rows}
              </tbody>

            </table>
          `
          : `
            <p class="muted">
              No students have submitted votes yet.
            </p>
          `
      }

    </div>
  `;
}


/*
=========================================================
DOWNLOAD VOTER LIST PDF
=========================================================
*/

function downloadVoterListPDF(
  students,
  electionName
) {

  if (
    !students ||
    students.length === 0
  ) {

    alert(
      'No voter records available.'
    );

    return;
  }


  const rows =
    students
      .map(
        (student, index) => {

          const votedAt =
            student.voted_at
              ? new Date(
                  student.voted_at
                ).toLocaleString()
              : '-';


          return `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHTML(
                  student.student_name
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.roll_no
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.branch
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.year
                )}
              </td>

              <td>
                ${escapeHTML(
                  student.email
                )}
              </td>

              <td>
                ${escapeHTML(
                  votedAt
                )}
              </td>

            </tr>
          `;

        }
      )
      .join('');


  const printWindow =
    window.open(
      '',
      '_blank'
    );


  if (!printWindow) {

    alert(
      'Please allow pop-ups to download the voter list.'
    );

    return;
  }


  printWindow.document.write(`

    <!DOCTYPE html>

    <html>

    <head>

      <title>
        Voter List -
        ${escapeHTML(
          electionName
        )}
      </title>


      <style>

        body {
          font-family: Arial, sans-serif;
          padding: 25px;
          color: #222;
        }

        h1,
        h2,
        p {
          text-align: center;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 25px;
        }

        th,
        td {
          border: 1px solid #777;
          padding: 9px;
          text-align: left;
          font-size: 12px;
        }

        th {
          background: #eeeeee;
        }

        @media print {

          body {
            padding: 10px;
          }

        }

      </style>

    </head>


    <body>

      <h1>
        College Election
      </h1>


      <p>
        ${escapeHTML(
          electionName
        )}
      </p>


      <p>
        Voter Participation Report
      </p>


      <h3>
        Total Students Voted:
        ${students.length}
      </h3>


      <table>

        <thead>

          <tr>

            <th>#</th>
            <th>Name</th>
            <th>Roll No</th>
            <th>Branch</th>
            <th>Year</th>
            <th>Email</th>
            <th>Voted At</th>

          </tr>

        </thead>


        <tbody>
          ${rows}
        </tbody>

      </table>

    </body>

    </html>

  `);


  printWindow.document.close();


  printWindow.onload = () => {

    printWindow.focus();

    printWindow.print();

  };
}


/*
=========================================================
COPY SUCCESS MESSAGE
=========================================================
*/

function showCopyMessage(
  button,
  message
) {

  const parent =
    button.parentElement;


  const oldMessage =
    parent.querySelector(
      '.copy-success-message'
    );


  if (oldMessage) {
    oldMessage.remove();
  }


  const messageBox =
    document.createElement(
      'div'
    );


  messageBox.className =
    'copy-success-message';


  messageBox.textContent =
    message;


  parent.appendChild(
    messageBox
  );


  setTimeout(
    () => {

      if (
        messageBox.parentElement
      ) {

        messageBox.remove();

      }

    },
    2000
  );
}

/*
=========================================================
STUDENT REQUESTS
=========================================================
*/

async function loadStudentRequests() {
  const container = document.getElementById(
    'student-requests'
  );

  if (!container) return;

  try {
    const data = await api(
      '/api/professor/student-requests',
      {
        token: professorToken(),
      }
    );

    const requests = data.requests || [];

    if (requests.length === 0) {
      container.innerHTML = `
        <p class="muted">
          No student requests yet.
        </p>
      `;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Email</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${requests.map((request, index) => {

              const status = String(
                request.status || 'Pending'
              );

              const statusClass =
                status === 'Approved'
                  ? 'Active'
                  : status === 'Rejected'
                    ? 'Ended'
                    : 'Scheduled';

              const actionButtons =
                status === 'Pending'
                  ? `
                    <button
                      class="btn"
                      type="button"
                      data-approve-request="${request.id}"
                    >
                      Approve
                    </button>

                    <button
                      class="btn danger"
                      type="button"
                      data-reject-request="${request.id}"
                    >
                      Reject
                    </button>
                  `
                  : `
                    <span class="muted">
                      No action needed
                    </span>
                  `;

              return `
                <tr>
                  <td>${index + 1}</td>

                  <td>
                    ${escapeHTML(request.name || '')}
                  </td>

                  <td>
                    ${escapeHTML(request.roll_no || '')}
                  </td>

                  <td>
                    ${escapeHTML(request.email || '')}
                  </td>

                  <td>
                    <span class="badge ${statusClass}">
                      ${escapeHTML(status)}
                    </span>
                  </td>

                  <td>
                    <div style="
                      display:flex;
                      gap:8px;
                      flex-wrap:wrap;
                    ">
                      ${actionButtons}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;


    /*
    -------------------------------------------------------
    APPROVE REQUEST
    -------------------------------------------------------
    */

    container
      .querySelectorAll('[data-approve-request]')
      .forEach((button) => {

        button.addEventListener(
          'click',
          async () => {

            const requestId = Number(
              button.getAttribute(
                'data-approve-request'
              )
            );

            try {

              await api(
                `/api/professor/student-requests/${requestId}`,
                {
                  method: 'PATCH',
                  token: professorToken(),
                  body: {
                    status: 'Approved',
                  },
                }
              );

              await loadStudentRequests();

            } catch (error) {

              alert(error.message);

            }

          }
        );

      });


    /*
    -------------------------------------------------------
    REJECT REQUEST
    -------------------------------------------------------
    */

    container
      .querySelectorAll('[data-reject-request]')
      .forEach((button) => {

        button.addEventListener(
          'click',
          async () => {

            const requestId = Number(
              button.getAttribute(
                'data-reject-request'
              )
            );

            try {

              await api(
                `/api/professor/student-requests/${requestId}`,
                {
                  method: 'PATCH',
                  token: professorToken(),
                  body: {
                    status: 'Rejected',
                  },
                }
              );

              await loadStudentRequests();

            } catch (error) {

              alert(error.message);

            }

          }
        );

      });

  } catch (error) {

    container.innerHTML = `
      <p class="muted">
        Unable to load student requests.
      </p>
    `;

    console.error(
      'Student requests error:',
      error
    );
  }
}
/*
=========================================================
PROFESSOR DASHBOARD
=========================================================
*/

async function initDashboard() {

  const list =
    document.getElementById(
      'elections'
    );


  if (!list) return;


  if (!requireProfessorPage()) {
    return;
  }
loadStudentRequests();
// Automatically check for new student requests every 3 seconds
setInterval(() => {
  loadStudentRequests();
}, 3000);
const refreshStudentRequestsButton =
  document.getElementById(
    'refresh-student-requests'
  );

if (refreshStudentRequestsButton) {
  refreshStudentRequestsButton.addEventListener(
    'click',
    loadStudentRequests
  );
}

  const alertBox =
    document.getElementById(
      'alert'
    );


  const logoutButton =
    document.getElementById(
      'logout-btn'
    );


  /*
  -------------------------------------------------------
  LOGOUT
  -------------------------------------------------------
  */

  if (logoutButton) {

    logoutButton.addEventListener(
      'click',
      () => {

        clearProfessor();

        window.location.href =
          '/professor-login.html';

      }
    );

  }


  let selectedId = null;


  /*
  -------------------------------------------------------
  LOAD PROFESSOR
  -------------------------------------------------------
  */

  async function loadWelcome() {

    const me =
      await api(
        '/api/professor/me',
        {
          token:
            professorToken(),
        }
      );


    const welcome =
      document.getElementById(
        'welcome'
      );


    if (welcome) {

      welcome.textContent =
        `Signed in as ${me.professor.name}`;

    }

  }


  /*
  -------------------------------------------------------
  REFRESH DASHBOARD
  -------------------------------------------------------
  */

  async function refresh() {

    const data =
      await api(
        '/api/elections',
        {
          token:
            professorToken(),
        }
      );


    /*
    -----------------------------------------------------
    NO ELECTIONS
    -----------------------------------------------------
    */

    if (
      !data.elections ||
      !data.elections.length
    ) {

      list.innerHTML = `
        <section class="card">

          <p>
            No elections yet.
            Create one to generate
            a link and key.
          </p>

        </section>
      `;

      return;
    }


    /*
    -----------------------------------------------------
    CHECK SELECTED ELECTION
    -----------------------------------------------------
    */

    const selectedStillExists =
      data.elections.some(
        (election) =>
          election.id === selectedId
      );


    if (
      !selectedId ||
      !selectedStillExists
    ) {

      selectedId =
        data.elections[0].id;

    }


    /*
    -----------------------------------------------------
    GET PRIVATE PROFESSOR RESULTS
    -----------------------------------------------------
    */

    const detail =
      await api(
        '/api/elections/' +
        selectedId +
        '/results',
        {
          token:
            professorToken(),
        }
      );


    /*
    -----------------------------------------------------
    RENDER ELECTIONS
    -----------------------------------------------------
    */

    list.innerHTML =
      data.elections
        .map(
          (election) => {

            const active =
              election.id ===
              selectedId;


            const extra =
              active
                ? renderDetail(
                    detail,
                    election
                  )
                : '';


            return `
              <section
                class="card election-card"
                data-id="${election.id}"
              >

                <div class="row-between">

                  <div>

                    <h2>

                      ${
                        election.is_priority
                          ? '★ '
                          : ''
                      }

                      ${escapeHTML(
                        election.election_name
                      )}

                    </h2>


                    <p>

                      <span
                        class="badge ${escapeHTML(
                          election.status
                        )}"
                      >
                        ${escapeHTML(
                          election.status
                        )}
                      </span>


                      <span class="muted">

                        Votes:
                        ${Number(
                          election.total_votes || 0
                        )}

                      </span>

                    </p>

                  </div>


                  <div
                    style="
                      display:flex;
                      gap:8px;
                      flex-wrap:wrap;
                      justify-content:flex-end;
                    "
                  >

                    <!-- PUBLIC LIVE RESULTS -->

                    <button
                      class="btn secondary"
                      type="button"
                      data-live-results="${escapeHTML(
                        election.election_code
                      )}"
                    >
                      View live results
                    </button>


                    <!-- PRIVATE PROFESSOR DETAILS -->

                    <button
                      class="btn secondary"
                      type="button"
                      data-select="${election.id}"
                    >
                      ${
                        active
                          ? 'Viewing details'
                          : 'View details'
                      }
                    </button>


                    <!-- PRIORITY -->

                    <button
                      class="btn secondary"
                      type="button"
                      data-priority="${election.id}"
                    >
                      ${
                        election.is_priority
                          ? '★ Priority'
                          : '☆ Save priority'
                      }
                    </button>


                    <!-- ARCHIVE -->

                    ${
                      election.status === 'Completed'
                        ? `
                          <button
                            class="btn danger"
                            type="button"
                            data-archive="${election.id}"
                          >
                            Archive
                          </button>
                        `
                        : ''
                    }

                  </div>

                </div>


                ${extra}

              </section>
            `;

          }
        )
        .join('');


    /*
    -----------------------------------------------------
    PUBLIC LIVE RESULTS BUTTONS
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-live-results]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            () => {

              const code =
                button.getAttribute(
                  'data-live-results'
                );


              const link =
                liveResultsLink(
                  code
                );


              window.open(
                link,
                '_blank',
                'noopener,noreferrer'
              );

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    SELECT / PRIVATE DETAILS BUTTONS
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-select]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            () => {

              selectedId =
                Number(
                  button.getAttribute(
                    'data-select'
                  )
                );


              refresh()
                .catch(
                  (error) => {

                    showAlert(
                      alertBox,
                      error.message
                    );

                  }
                );

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    PRIORITY BUTTONS
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-priority]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            async () => {

              const electionId =
                Number(
                  button.getAttribute(
                    'data-priority'
                  )
                );


              const election =
                data.elections.find(
                  (item) =>
                    item.id ===
                    electionId
                );


              if (!election) {
                return;
              }


              try {

                await api(
                  `/api/elections/${electionId}/priority`,
                  {
                    method: 'PATCH',

                    token:
                      professorToken(),

                    body: {
                      is_priority:
                        !election.is_priority,
                    },

                  }
                );


                await refresh();

              } catch (error) {

                showAlert(
                  alertBox,
                  error.message
                );

              }

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    ARCHIVE BUTTONS
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-archive]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            async () => {

              const electionId =
                Number(
                  button.getAttribute(
                    'data-archive'
                  )
                );


              const election =
                data.elections.find(
                  (item) =>
                    item.id ===
                    electionId
                );


              if (!election) {
                return;
              }


              const confirmed =
                window.confirm(
                  `Archive "${election.election_name}"?\n\nThe election will disappear from the dashboard list, but its data will be preserved.`
                );


              if (!confirmed) {
                return;
              }


              try {

                await api(
                  `/api/elections/${electionId}/archive`,
                  {
                    method: 'PATCH',

                    token:
                      professorToken(),
                  }
                );


                if (
                  selectedId === electionId
                ) {

                  selectedId =
                    null;

                }


                await refresh();

              } catch (error) {

                showAlert(
                  alertBox,
                  error.message
                );

              }

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    DETAIL ACTIONS
    -----------------------------------------------------
    */

    bindDetailActions(
      detail,
      data.elections.find(
        (election) =>
          election.id === selectedId
      )
    );

  }


  /*
  =======================================================
  RENDER ELECTION DETAIL
  =======================================================
  */

  function renderDetail(
    detail,
    election
  ) {

    const link =
      electionLink(
        election.election_code
      );


    const liveLink =
      liveResultsLink(
        election.election_code
      );


    const percentage =
      detail.voting_percentage == null
        ? 'Set expected voters to see turnout'
        : detail.voting_percentage +
          '%';


    return `

      <div class="stats">

        <div class="stat-card">

          <span>
            Total votes
          </span>

          <strong>
            ${Number(
              detail.total_votes || 0
            )}
          </strong>

        </div>


        <div class="stat-card">

          <span>
            Students who voted
          </span>

          <strong>
            ${Number(
              detail.total_students_voted || 0
            )}
          </strong>

        </div>


        <div class="stat-card">

          <span>
            Turnout
          </span>

          <strong>
            ${escapeHTML(
              percentage
            )}
          </strong>

        </div>


        <div class="stat-card">

          <span>
            Status
          </span>

          <strong>
            ${escapeHTML(
              detail.election.status
            )}
          </strong>

        </div>

      </div>


      <!-- NORMAL ELECTION LINK -->

      <div class="secret-box">

        <div>

          <div class="muted">
            Election link
          </div>

          <code>
            ${escapeHTML(
              link
            )}
          </code>

        </div>


        <button
          class="btn secondary"
          type="button"
          data-copy-link="${escapeHTML(
            link
          )}"
        >
          Copy link
        </button>

      </div>


      <!-- PUBLIC LIVE COUNTING LINK -->

      <div class="secret-box">

        <div>

          <div class="muted">
            Live counting link
          </div>

          <code>
            ${escapeHTML(
              liveLink
            )}
          </code>

        </div>


        <div
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          "
        >

          <button
            class="btn secondary"
            type="button"
            data-copy-live-link="${escapeHTML(
              liveLink
            )}"
          >
            Copy live link
          </button>


          <a
            class="btn"
            href="${escapeHTML(
              liveLink
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open live counting
          </a>

        </div>

      </div>


      <!-- ELECTION KEY -->

      <div class="secret-box">

        <div>

          <div class="muted">
            Election key
          </div>

          <code>
            ${escapeHTML(
              election.election_key
            )}
          </code>

        </div>


        <button
          class="btn secondary"
          type="button"
          data-copy-key="${escapeHTML(
            election.election_key
          )}"
        >
          Copy key
        </button>

      </div>


      ${candidateTable(
        detail.positions
      )}


      ${studentVoterTable(
        detail.students
      )}

    `;
  }


  /*
  =======================================================
  DETAIL ACTIONS
  =======================================================
  */

  function bindDetailActions(
    detail,
    election
  ) {

    /*
    -----------------------------------------------------
    COPY ELECTION LINK
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-copy-link]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            async () => {

              try {

                await copyText(
                  button.getAttribute(
                    'data-copy-link'
                  )
                );


                showCopyMessage(
                  button,
                  'Election link copied!'
                );

              } catch (error) {

                alert(
                  'Unable to copy the election link.'
                );

              }

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    COPY LIVE COUNTING LINK
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-copy-live-link]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            async () => {

              try {

                await copyText(
                  button.getAttribute(
                    'data-copy-live-link'
                  )
                );


                showCopyMessage(
                  button,
                  'Live counting link copied!'
                );

              } catch (error) {

                alert(
                  'Unable to copy the live counting link.'
                );

              }

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    COPY ELECTION KEY
    -----------------------------------------------------
    */

    list
      .querySelectorAll(
        '[data-copy-key]'
      )
      .forEach(
        (button) => {

          button.addEventListener(
            'click',
            async () => {

              try {

                await copyText(
                  button.getAttribute(
                    'data-copy-key'
                  )
                );


                showCopyMessage(
                  button,
                  'Election key copied!'
                );

              } catch (error) {

                alert(
                  'Unable to copy the election key.'
                );

              }

            }
          );

        }
      );


    /*
    -----------------------------------------------------
    DOWNLOAD VOTER LIST
    -----------------------------------------------------
    */

    const downloadButton =
      list.querySelector(
        '[data-download-voter-list]'
      );


    if (downloadButton) {

      downloadButton.addEventListener(
        'click',
        () => {

          downloadVoterListPDF(
            detail.students || [],
            detail.election.election_name
          );

        }
      );

    }

  }


  /*
  =======================================================
  INITIAL LOAD
  =======================================================
  */

  try {

    await loadWelcome();

    await refresh();


    /*
    -----------------------------------------------------
    LIVE DASHBOARD REFRESH
    -----------------------------------------------------
    */

    setInterval(
      () => {

        refresh()
          .catch(
            (error) => {

              if (
                error.status === 401
              ) {

                clearProfessor();

                window.location.href =
                  '/professor-login.html';

              }

            }
          );

      },
      2500
    );


  } catch (error) {

    if (
      error.status === 401
    ) {

      clearProfessor();

      window.location.href =
        '/professor-login.html';

      return;
    }


    showAlert(
      alertBox,
      error.message
    );

  }
}


/*
=========================================================
PAGE INITIALIZATION
=========================================================
*/

document.addEventListener(
  'DOMContentLoaded',
  () => {

    initLoginPage();

    initCreatePage();

    initDashboard();

  }
);