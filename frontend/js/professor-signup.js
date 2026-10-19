document.addEventListener(
  'DOMContentLoaded',
  () => {

    const form =
      document.getElementById('signup-form');

    if (!form) return;


    const alertBox =
      document.getElementById('alert');


    form.addEventListener(
      'submit',
      async (event) => {

        event.preventDefault();

        hideAlert(alertBox);


        const body =
          Object.fromEntries(
            new FormData(form).entries()
          );


        if (
          body.password !==
          body.confirm_password
        ) {

          showAlert(
            alertBox,
            'Passwords do not match.'
          );

          return;
        }


        try {

          const data =
            await api(
              '/api/professor/signup',
              {
                method: 'POST',

                body: {
                  name: body.name,
                  email: body.email,
                  password: body.password,
                },
              }
            );


          showAlert(
            alertBox,
            data.message ||
              'Account created successfully.',
            'success'
          );


          form.reset();


          setTimeout(
            () => {

              window.location.href =
                '/professor-login.html';

            },
            1200
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
);