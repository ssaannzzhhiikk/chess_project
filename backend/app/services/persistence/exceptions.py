class PersistenceError(Exception):
    pass


class DuplicateEmailError(PersistenceError):
    pass


class EntityNotFoundError(PersistenceError):
    pass
