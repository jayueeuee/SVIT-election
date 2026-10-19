/*
=========================================================
LIVE RESULTS PAGE
=========================================================
*/

let refreshTimer = null;


/*
=========================================================
ESCAPE HTML
=========================================================
*/

function escapeLiveHTML(value) {

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
GET ELECTION CODE
=========================================================
*/

function getElectionCode() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get('code');

}


/*
=========================================================
RENDER CANDIDATE
=========================================================
*/

function renderCandidate(
  candidate,
  maxVotes
) {

  const votes =
    Number(
      candidate.votes || 0
    );


  const percentage =
    maxVotes > 0
      ? Math.round(
          (votes / maxVotes) * 100
        )
      : 0;


  return `
    <div
      class="card"
      style="
        margin-top:12px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:center;
        "
      >

        <div>

          <strong>
            ${escapeLiveHTML(
              candidate.candidate_name
            )}
          </strong>

          ${
            candidate.branch || candidate.year
              ? `
                <div
                  class="muted"
                  style="margin-top:4px;"
                >
                  ${escapeLiveHTML(
                    candidate.branch || ''
                  )}

                  ${
                    candidate.branch &&
                    candidate.year
                      ? ' • '
                      : ''
                  }

                  ${escapeLiveHTML(
                    candidate.year || ''
                  )}
                </div>
              `
              : ''
          }

        </div>


        <div
          style="
            text-align:right;
            min-width:70px;
          "
        >

          <strong
            style="
              font-size:22px;
            "
          >
            ${votes}
          </strong>

          <div class="muted">
            votes
          </div>

        </div>

      </div>


      <div
        style="
          width:100%;
          height:10px;
          background:#e5e7eb;
          border-radius:999px;
          overflow:hidden;
          margin-top:12px;
        "
      >

        <div
          style="
            width:${percentage}%;
            height:100%;
            background:#2563eb;
            transition:width 0.5s ease;
          "
        ></div>

      </div>


      <div
        class="muted"
        style="
          margin-top:6px;
          font-size:13px;
        "
      >
        ${percentage}% of votes
      </div>

    </div>
  `;

}


/*
=========================================================
RENDER POSITIONS
=========================================================
*/

function renderPositions(
  positions
) {

  if (
    !positions ||
    positions.length === 0
  ) {

    return `
      <section class="card">

        <p class="muted">
          No positions available.
        </p>

      </section>
    `;

  }


  return positions
    .map(
      (position) => {

        const candidates =
          position.candidates || [];


        const maxVotes =
          candidates.length
            ? Math.max(
                ...candidates.map(
                  (candidate) =>
                    Number(
                      candidate.votes || 0
                    )
                )
              )
            : 0;


        return `
          <section
            class="card"
            style="
              margin-top:20px;
            "
          >

            <h2>
              ${escapeLiveHTML(
                position.position_name
              )}
            </h2>


            ${
              candidates.length
                ? candidates
                    .map(
                      (candidate) =>
                        renderCandidate(
                          candidate,
                          maxVotes
                        )
                    )
                    .join('')
                : `
                  <p class="muted">
                    No candidates available.
                  </p>
                `
            }

          </section>
        `;

      }
    )
    .join('');

}


/*
=========================================================
LOAD LIVE RESULTS
=========================================================
*/
function formatElectionDate(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
async function loadLiveResults() {

  const code =
    getElectionCode();


  const loading =
    document.getElementById(
      'loading'
    );

  const results =
    document.getElementById(
      'results'
    );

  const alertBox =
    document.getElementById(
      'alert'
    );


  if (!code) {

    loading.classList.add(
      'hidden'
    );

    showAlert(
      alertBox,
      'Invalid election link.'
    );

    return;

  }


  try {

    const data =
      await api(
        `/api/elections/${encodeURIComponent(
          code
        )}/live-results`
      );


    const election =
      data.election;


    /*
    -----------------------------------------------------
    ELECTION INFORMATION
    -----------------------------------------------------
    */

    document.getElementById(
      'election-name'
    ).textContent =
      election.election_name;


    document.getElementById(
      'election-description'
    ).textContent =
      election.description || '';


    document.getElementById(
      'total-votes'
    ).textContent =
      Number(
        data.total_votes || 0
      );


    document.getElementById(
      'status'
    ).textContent =
      election.status;

document.getElementById('start-time').textContent =
  formatElectionDate(data.election.start_time);

document.getElementById('end-time').textContent =
  formatElectionDate(data.election.end_time);
    /*
    -----------------------------------------------------
    LAST UPDATED
    -----------------------------------------------------
    */

    document.getElementById(
      'last-updated'
    ).textContent =
      new Date().toLocaleTimeString();


    /*
    -----------------------------------------------------
    POSITIONS
    -----------------------------------------------------
    */

    document.getElementById(
      'positions'
    ).innerHTML =
      renderPositions(
        data.positions
      );


    loading.classList.add(
      'hidden'
    );


    results.classList.remove(
      'hidden'
    );


  } catch (error) {

    console.error(
      'Live results error:',
      error
    );


    loading.classList.add(
      'hidden'
    );


    showAlert(
      alertBox,
      error.message ||
        'Unable to load live results.'
    );

  }

}


/*
=========================================================
START
=========================================================
*/

document.addEventListener(
  'DOMContentLoaded',
  () => {

    loadLiveResults();


    /*
    -----------------------------------------------------
    AUTO REFRESH
    -----------------------------------------------------
    */

    refreshTimer =
      setInterval(
        () => {

          loadLiveResults();

        },
        2500
      );

  }
);