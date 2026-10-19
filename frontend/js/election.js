document.addEventListener('DOMContentLoaded', () => {
  const code = electionCodeFromLocation();
  const meta = document.getElementById('election-meta');
  const form = document.getElementById('student-form');
  const alertBox = document.getElementById('alert');

  let pendingCheckTimer = null;
  let pendingPayload = null;
  let checkingApproval = false;
  let redirecting = false;

  if (!code) {
    meta.innerHTML = '<h1>Election not found</h1>';
    return;
  }

  /*
  =========================================================
  LOAD ELECTION
  =========================================================
  */

  api('/api/elections/' + encodeURIComponent(code))
    .then((data) => {
      const e = data.election;

      meta.innerHTML = `
        <h1>${e.election_name}</h1>

        <p>${e.description || ''}</p>

        <p>
          <span class="badge ${e.status}">
            ${e.status}
          </span>
        </p>

        <p class="muted">
          Voting window:
          ${formatDate(e.start_time)}
          —
          ${formatDate(e.end_time)}
        </p>
      `;

      if (e.status !== 'Active') {
        showAlert(
          alertBox,
          e.status === 'Scheduled'
            ? 'Voting is not currently active. This election has not started.'
            : 'Voting is not currently active. This election has ended.'
        );

        return;
      }

      form.classList.remove('hidden');
    })
    .catch((error) => {
      meta.innerHTML = '<h1>Election not found</h1>';
      showAlert(alertBox, error.message);
    });

  /*
  =========================================================
  SHOW PENDING REQUEST
  =========================================================
  */

  function showPendingScreen() {
    form.classList.add('hidden');

    showAlert(
      alertBox,
      '⏳ Your request is pending professor approval. Waiting automatically...',
      'success'
    );

    /*
    -------------------------------------------------------
    START AUTO CHECK
    -------------------------------------------------------
    */

    if (!pendingCheckTimer) {
      pendingCheckTimer = setInterval(
        checkApprovalStatus,
        1000
      );
    }
  }

  /*
  =========================================================
  CHECK APPROVAL STATUS
  =========================================================
  */

  async function checkApprovalStatus() {
    if (!pendingPayload || checkingApproval || redirecting) {
      return;
    }

    checkingApproval = true;

    try {
      const data = await api(
        '/api/elections/' +
          encodeURIComponent(code) +
          '/student-login',
        {
          method: 'POST',
          body: pendingPayload,
        }
      );

      /*
      -------------------------------------------------------
      APPROVED
      -------------------------------------------------------
      */

      redirecting = true;

      if (pendingCheckTimer) {
        clearInterval(pendingCheckTimer);
        pendingCheckTimer = null;
      }

      /*
      -------------------------------------------------------
      SAVE STUDENT SESSION
      -------------------------------------------------------
      */

      setStudentSession({
        token: data.token,
        code,
        election: data.election,
        positions: data.positions,

        student: {
          student_name: pendingPayload.student_name,
          roll_no: pendingPayload.roll_no,
          branch: pendingPayload.branch,
          year: pendingPayload.year,
          email: pendingPayload.email,
        },

        election_key: pendingPayload.election_key,
      });

      showAlert(
        alertBox,
        '✓ Request approved! Opening voting options...',
        'success'
      );

      /*
      -------------------------------------------------------
      GO TO VOTING PAGE
      -------------------------------------------------------
      */

      setTimeout(() => {
        window.location.href =
          '/voting/' + encodeURIComponent(code);
      }, 300);

    } catch (error) {

      const message =
        String(error.message || '').toLowerCase();

      /*
      -------------------------------------------------------
      STILL PENDING
      -------------------------------------------------------

      Backend can return either:
      - pending approval
      - not been approved
      - still pending
      -------------------------------------------------------
      */

      if (
        message.includes('pending') ||
        message.includes('not been approved') ||
        message.includes('still pending')
      ) {
        return;
      }

      /*
      -------------------------------------------------------
      REJECTED
      -------------------------------------------------------
      */

      if (
        message.includes('rejected')
      ) {
        if (pendingCheckTimer) {
          clearInterval(pendingCheckTimer);
          pendingCheckTimer = null;
        }

        checkingApproval = false;

        showAlert(
          alertBox,
          '❌ Your student request has been rejected by the professor.'
        );

        return;
      }

      /*
      -------------------------------------------------------
      OTHER ERROR
      -------------------------------------------------------
      */

      console.error(
        'Automatic approval check error:',
        error
      );

    } finally {
      checkingApproval = false;
    }
  }

  /*
  =========================================================
  STUDENT VERIFY / CONTINUE
  =========================================================
  */

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    hideAlert(alertBox);

    const payload = Object.fromEntries(
      new FormData(form).entries()
    );

    pendingPayload = payload;

    try {
      const data = await api(
        '/api/elections/' +
          encodeURIComponent(code) +
          '/student-login',
        {
          method: 'POST',
          body: payload,
        }
      );

      /*
      -------------------------------------------------------
      ALREADY APPROVED
      -------------------------------------------------------
      */

      redirecting = true;

      if (pendingCheckTimer) {
        clearInterval(pendingCheckTimer);
        pendingCheckTimer = null;
      }

      setStudentSession({
        token: data.token,
        code,
        election: data.election,
        positions: data.positions,

        student: {
          student_name: payload.student_name,
          roll_no: payload.roll_no,
          branch: payload.branch,
          year: payload.year,
          email: payload.email,
        },

        election_key: payload.election_key,
      });

      showAlert(
        alertBox,
        '✓ Verification successful! Opening voting options...',
        'success'
      );

      setTimeout(() => {
        window.location.href =
          '/voting/' + encodeURIComponent(code);
      }, 300);

    } catch (error) {

      const message =
        String(error.message || '').toLowerCase();

      /*
      -------------------------------------------------------
      PENDING APPROVAL
      -------------------------------------------------------
      */

      if (
        message.includes('pending') ||
        message.includes('not been approved') ||
        message.includes('still pending')
      ) {
        showPendingScreen();
        return;
      }

      /*
      -------------------------------------------------------
      REJECTED
      -------------------------------------------------------
      */

      if (
        message.includes('rejected')
      ) {
        showAlert(
          alertBox,
          '❌ Your student request has been rejected by the professor.'
        );

        return;
      }

      /*
      -------------------------------------------------------
      OTHER ERRORS
      -------------------------------------------------------
      */

      showAlert(
        alertBox,
        error.message
      );
    }
  });

  /*
  =========================================================
  CLEANUP TIMER
  =========================================================
  */

  window.addEventListener('beforeunload', () => {
    if (pendingCheckTimer) {
      clearInterval(pendingCheckTimer);
      pendingCheckTimer = null;
    }
  });
});