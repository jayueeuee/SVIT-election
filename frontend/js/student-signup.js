document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('student-signup-form');

  if (!form) return;

  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (event) => {

    event.preventDefault();

    hideAlert(alertBox);

    const body = Object.fromEntries(
      new FormData(form).entries()
    );

    if (body.password !== body.confirm_password) {

      showAlert(
        alertBox,
        'Passwords do not match.'
      );

      return;
    }

    try {

      const data = await api(
        '/api/student/signup',
        {
          method: 'POST',
          body: {
            name: body.name,
            email: body.email,
            password: body.password,
            roll_no: body.roll_no,
            branch: body.branch,
            student_year: body.student_year
          }
        }
      );

      showAlert(
        alertBox,
        data.message || 'Account created successfully.',
        'success'
      );

      form.reset();

      setTimeout(() => {

        window.location.href =
          '/student-login.html';

      }, 1200);

    } catch (error) {

      showAlert(
        alertBox,
        error.message
      );

    }

  });

});