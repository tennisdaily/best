async function submitContactForm(event) {
    event.preventDefault();
    const btn = document.getElementById('contact-submit-btn');
    const success = document.getElementById('contact-success');
    const errorMsg = document.getElementById('contact-error');
    success.classList.add('hidden');
    errorMsg.classList.add('hidden');
    btn.disabled = true;

    const payload = {
        name: document.getElementById('contact-name').value,
        email: document.getElementById('contact-email').value,
        message: document.getElementById('contact-message').value
    };

    const { error } = await _supabase.from('contacts').insert([payload]);
    btn.disabled = false;

    if (error) {
        errorMsg.classList.remove('hidden');
        console.error(error);
        return;
    }
    document.getElementById('contact-form').reset();
    success.classList.remove('hidden');
}

bootChrome('contact');
