document.addEventListener('DOMContentLoaded', async () => {
  const code = electionCodeFromLocation();
  const session = getStudentSession();
  const meta = document.getElementById('meta');
  const ballot = document.getElementById('ballot');
  const alertBox = document.getElementById('alert');
  const modal = document.getElementById('modal');
  const confirmText = document.getElementById('confirm-text');

  let selected = null;

  if (!code || !session || session.code !== code || !session.token) {
    window.location.href = '/election/' + encodeURIComponent(code || '');
    return;
  }

  try {
    const data = await api(
      '/api/elections/' + encodeURIComponent(code) + '/ballot',
      {
        token: session.token,
      }
    );

    render(data);
  } catch (error) {
    if (error.status === 409) {
      window.location.href = '/vote-success.html';
      return;
    }

    showAlert(alertBox, error.message);
  }

  function render(data) {
    meta.innerHTML = `
      <h1>${data.election.election_name}</h1>

      <p class="muted">
        Verified as
        <strong>${data.student.student_name}</strong>
        (${data.student.email})
      </p>

      <p class="muted">
        Roll No: <strong>${data.student.roll_no}</strong>
        · Branch: <strong>${data.student.branch}</strong>
        · Year: <strong>${data.student.year || 'Not specified'}</strong>
      </p>

      <p class="muted">
        You may vote for exactly one candidate.
      </p>
    `;

    ballot.innerHTML = data.positions
      .map(
        (position) => `
        <div class="position-block">
          <h2>${position.position_name}</h2>

          ${position.candidates
            .map(
              (candidate) => `
              <label class="candidate">
                <input
                  type="radio"
                  name="candidate_id"
                  value="${candidate.id}"
                >

                <div>
                  <strong>${candidate.candidate_name}</strong>

                  <div class="muted">
                    ${[candidate.branch, candidate.year]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>

                  <div>
                    ${candidate.manifesto || ''}
                  </div>
                </div>
              </label>
            `
            )
            .join('')}
        </div>
      `
      )
      .join('');

    ballot.innerHTML += `
      <button class="btn" type="submit">
        Continue to confirmation
      </button>
    `;

    ballot.classList.remove('hidden');

    ballot.addEventListener('change', () => {
      document
        .querySelectorAll('.candidate')
        .forEach((el) => el.classList.remove('selected'));

      const checked = ballot.querySelector(
        'input[name="candidate_id"]:checked'
      );

      if (checked) {
        checked.closest('.candidate').classList.add('selected');
      }
    });
  }

  ballot.addEventListener('submit', (event) => {
    event.preventDefault();

    const value = new FormData(ballot).get('candidate_id');

    if (!value) {
      showAlert(alertBox, 'Please select exactly one candidate.');
      return;
    }

    const input = ballot.querySelector(
      `input[value="${value}"]`
    );

    const label = input.closest('.candidate');

    selected = {
      id: Number(value),
      name: label.querySelector('strong').textContent,
      election: session.election.election_name,
    };

    confirmText.textContent =
      `You are voting for ${selected.name} in ${selected.election}.`;

    modal.classList.remove('hidden');
  });

  document
    .getElementById('cancel-vote')
    .addEventListener('click', () => {
      modal.classList.add('hidden');
    });

  document
    .getElementById('confirm-vote')
    .addEventListener('click', async () => {
      if (!selected) return;

      const button = document.getElementById('confirm-vote');

      button.disabled = true;

      try {
        const result = await api(
          '/api/elections/' + encodeURIComponent(code) + '/vote',
          {
            method: 'POST',
            token: session.token,
            body: {
              candidate_id: selected.id,
              election_key: session.election_key,
            },
          }
        );

        clearStudentSession();

        const params = new URLSearchParams({
          election: result.election_name,
          candidate: result.candidate_name,
        });

        window.location.href =
          '/vote-success.html?' + params.toString();
      } catch (error) {
        button.disabled = false;
        modal.classList.add('hidden');
        showAlert(alertBox, error.message);
      }
    });
});