import { Router } from 'express';
import { 
  SecretController,
  createSecretValidation,
  updateSecretValidation,
  secretIdValidation,
  folderIdValidation
} from '../controllers/secretController';
import { authenticateToken } from '../lib/auth';

const router = Router();
const secretController = new SecretController();

// All routes require authentication
router.use(authenticateToken);

// Secret CRUD operations
router.post('/', createSecretValidation, secretController.createSecret);
router.get('/:secretId', secretIdValidation, secretController.getSecret);
router.get('/:secretId/value', secretIdValidation, secretController.getSecretValue);
router.put('/:secretId', updateSecretValidation, secretController.updateSecret);
router.delete('/:secretId', secretIdValidation, secretController.deleteSecret);

// Secret versions
router.get('/:secretId/versions', secretIdValidation, secretController.getSecretVersions);

// Folder secrets
router.get('/folders/:folderId/secrets', folderIdValidation, secretController.getFolderSecrets);

export default router;
