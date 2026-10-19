document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('student-login-form');

  if (!form) return;

  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (event) => {

    event.preventDefault();

    hideAlert(alertBox);

    const body = Object.fromEntries(
      new FormData(form).entries()
    );

    try {

      const data = await api(
        '/api/student/login',
        {
          method: 'POST',
          body: {
            email: body.email,
            password: body.password
          }
        }
      );

      // Save student login information
      localStorage.setItem(
        'student_token',
        data.token
      );

      localStorage.setItem(
        'student',
        JSON.stringify(data.student)
      );

      showAlert(
        alertBox,
        'Login successful.',
        'success'
      );

      /*
       * Login successful.
       *
       * We keep the student on this page so
       * they can enter an election code.
       */

      form.reset();

    } catch (error) {

      showAlert(
        alertBox,
        error.message
      );

    }

  });

});     